#!/usr/bin/env python3.7
import asyncio
import ssl
import websockets
import json
import psycopg2 as psql
import uuid
import sys
import os
from pathlib import Path
from contextlib import contextmanager
from google.oauth2 import id_token
from google.auth.transport import requests
from functools import lru_cache


connected_sockets = set()
event_groups = {}
request_handlers = {}
upload_root = Path("/var/townhall/")

with open("/etc/oauth/oauth.json") as fp:
    GOOGLE_OAUTH = json.load(fp)

GOOGLE_OAUTH_CLIENT_ID = GOOGLE_OAUTH['CLIENT_ID']


def main():
    # Set up SSL context
    ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ssl_context.load_cert_chain(
        "/etc/letsencrypt/live/miravalier.net/fullchain.pem",
        keyfile="/etc/letsencrypt/live/miravalier.net/privkey.pem"
    )
    # Host server
    asyncio.get_event_loop().run_until_complete(
        websockets.serve(
            handle_connection,
            "0.0.0.0",
            3030,
            ssl=ssl_context
        )
    )
    asyncio.get_event_loop().run_forever()


@contextmanager
def cursor():
    connection = psql.connect("dbname=dnd")
    cur = connection.cursor()
    try:
        yield cur
    finally:
        cur.close()
        connection.commit()
        connection.close()


def execute_and_return(*args, **kwargs):
    with cursor() as cur:
        cur.execute(*args, **kwargs)
        return cur.fetchone()


def execute(*args, **kwargs):
    with cursor() as cur:
        cur.execute(*args, **kwargs)


def query(*args, **kwargs):
    with cursor() as cur:
        cur.execute(*args, **kwargs)
        return cur.fetchall()


def single_query(*args, **kwargs):
    with cursor() as cur:
        cur.execute(*args, **kwargs)
        result = cur.fetchone()
        if result and len(result) == 1:
            return result[0]
        else:
            return result


async def attempt_send(websocket, msg):
    try:
        await websocket.send(msg)
        return websocket, True
    except:
        return websocket, False


async def broadcast(msg, group=connected_sockets):
    msg_string = json.dumps(msg)
    results = await asyncio.gather(*(
        attempt_send(websocket, msg_string)
        for websocket in group
    ))
    for websocket, success in results:
        if not success:
            group.discard(websocket)


async def debug_error(msg):
    await broadcast({"type": "error", "reason": msg})


async def debug_log(msg):
    await broadcast({"type": "debug", "reason": msg})


def register_handler(message_type):
    def sub_register_handler(func):
        request_handlers[message_type] = func
        return func
    return sub_register_handler


@register_handler("download file")
async def _ (account, message, websocket):
    file_id = message.get("id", None)
    request_id = message.get("request id", None)
    if file_id is None or request_id is None:
        return {"type": "error", "reason": "download request missing id"}

    try:
        file_type, file_uuid = single_query("SELECT file_type, file_uuid FROM files WHERE file_id=%s", (file_id,))
    except:
        return {"type": "error", "reason": "file id {} does not exist".format(file_id)}
    if file_uuid is None:
        return {"type": "error", "reason": "id {} not backed by file".format(file_id)}

    with open(upload_root / file_uuid, "rb") as fp:
        file_data = request_id.to_bytes(4, 'big') + fp.read()

    await websocket.send(file_data)


@register_handler("open file")
async def _ (account, message, websocket):
    file_id = message.get("id", None)
    if file_id is None:
        return {"type": "error", "reason": "open request missing file id"}

    return {"type": "debug", "reason": "file open not implemented yet"}


@register_handler("upload file")
async def _ (account, message, websocket):
    try:
        file_data = await websocket.recv()
        if type(file_data) is not bytes:
            raise TypeError("file data not binary")
        if len(file_data) > 5242880:
            return {"type": "error", "reason": "file too large"}
    except:
        return {"type": "error", "reason": "failed to receive file data"}
    file_name = message.get("name", None)
    if file_name is None:
        return {"type": "error", "reason": "missing file name"}
    directory_id = message.get("id", None)
    if directory_id is None:
        return {"type": "error", "reason": "missing directory id"}

    file_uuid = str(uuid.uuid4())
    file_type = sniff(file_data)

    with open(upload_root / file_uuid, "wb") as fp:
        fp.write(file_data)

    execute("""
        INSERT INTO files (file_name, file_type, owner_id, parent_id, file_uuid)
        VALUES (%s, %s, %s, %s, %s)
    """, (file_name, file_type, account.user_id, directory_id, file_uuid))

    return {"type": "event", "id": "files updated"}


@register_handler("get parent")
async def _ (account, message, websocket):
    file_id = message.get("id", None)
    if file_id is None:
        return {"type": "error", "reason": "missing file id"}

    return {
        "type": "file parent",
        "child": file_id,
        "parent": single_query("SELECT parent_id FROM files WHERE file_id=%s", (file_id,))
    }


@register_handler("ls")
async def _ (account, message, websocket):
    directory_id = message.get("id", None)
    if directory_id is None:
        return {"type": "error", "reason": "missing directory id"}

    return {
        "type": "directory listing",
        "nodes": query(
            """
                SELECT file_name, file_id, file_type FROM files
                WHERE parent_id=%s
            """,
            (directory_id,)
        )
    }


@register_handler("register event")
async def _ (account, message, websocket):
    event_id = message.get("id", None)
    if event_id in event_groups:
        event_groups[event_id].add(websocket)
    else:
        event_groups[event_id] = {websocket}
        await broadcast({"type": "event created", "id": event_id})
    return {"type": "event registered", "id": event_id}


@register_handler("deregister event")
async def _ (account, message, websocket):
    event_id = message.get("id", None)
    if event_id not in event_groups:
        return {"type": "error", "reason": "non-existent event id"}
    event_groups[event_id].discard(websocket)
    if not event_groups[event_id]:
        del event_groups[event_id]


@register_handler("update username")
async def _ (account, message, websocket):
    new_name = message.get("name", None)
    if new_name is None:
        return {"type": "error", "reason": "missing updated username"}
    account.user_name = new_name
    execute("UPDATE users SET user_name=%s WHERE user_id=%s", (new_name, account.user_id))
    get_user_name.cache_clear()
    await broadcast({"type": "username update", "id": account.user_id, "name": new_name})


@register_handler("query username")
async def _ (account, message, websocket):
    user_id = message.get("id", None)
    if user_id is None:
        return {"type": "error", "reason": "username query missing user id"}
    return {"type": "username update", "id": user_id, "name": get_user_name(user_id)}


@register_handler("delete file")
async def _ (account, message, websocket):
    file_id = message.get("id", None)
    if file_id is None:
        return {"type": "error", "reason": "delete file missing file id"}
    file_uuid, file_type = single_query("SELECT file_uuid, file_type FROM files WHERE file_id=%s", (file_id,))
    deleted = 1
    if file_type == "directory":
        deleted += delete_children(file_id)
    execute("DELETE FROM files WHERE file_id=%s", (file_id,));
    if file_uuid:
        os.unlink(str(upload_root / file_uuid))

    return {"type": "event", "id": "files updated"}


def delete_children(file_id):
    deleted = 0
    children = query("SELECT file_uuid, file_id, file_type FROM files WHERE parent_id=%s", (file_id,))
    for child_uuid, child_id, child_type in children:
        if child_type == "directory":
            deleted += delete_children(child_id)
        if child_uuid:
            os.unlink(str(upload_root / child_uuid))
        deleted += 1
    execute("DELETE FROM files WHERE parent_id=%s", (file_id,))
    return deleted


@register_handler("add subfolder")
async def _ (account, message, websocket):
    directory_name = message.get("name", None)
    directory_id = message.get("id", None)
    if directory_name is None:
        return {"type": "error", "reason": "add subfolder missing name"}
    if directory_id is None:
        return {"type": "error", "reason": "add subfolder missing parent id"}

    execute("""
        INSERT INTO files (file_name, file_type, owner_id, parent_id)
        VALUES (%s, %s, %s, %s)
    """, (directory_name, "directory", account.user_id, directory_id))

    return {"type": "event", "id": "files updated"}


@register_handler("rename file")
async def _ (account, message, websocket):
    file_name = message.get("name", None)
    file_id = message.get("id", None)
    if file_name is None:
        return {"type": "error", "reason": "rename file missing name"}
    if file_id is None:
        return {"type": "error", "reason": "rename file missing file id"}

    execute("""
        UPDATE files SET file_name=%s WHERE file_id=%s
    """, (file_name, file_id))

    return {"type": "event", "id": "files updated"}


@register_handler("chat message")
async def _ (account, message, websocket):
    text = message.get("text", "")
    category = message.get("category", "ooc")
    display_name = message.get("display name", account.user_name)
    result = execute_and_return('''
        INSERT INTO messages (message_id, sender_id, category, display_name, content)
        VALUES (DEFAULT, %s, %s, %s, %s)
        RETURNING message_id
    ''', (account.user_id, category, display_name, text))

    await broadcast({
        "type": "event", "user": account.user_id, "id": "chat message", "data": {
            "category": category, "display name": display_name, "id": result[0], "text": text
        }
    })


@register_handler("trigger event")
async def _ (account, message, websocket):
    event_id = message.get("id", None)
    event_data = message.get("data", None)
    if event_id not in event_groups:
        return {"type": "error", "reason": "non-existent event id"}
    await broadcast(
        {"type": "event", "user": account.user_id, "id": event_id, "data": event_data},
        event_groups[event_id]
    )


@register_handler("clear history")
async def _ (account, message, websocket):
    execute("DELETE FROM messages");
    await broadcast({"type": "event", "id": "clear history"})


@register_handler("request history")
async def _ (account, message, websocket):
    return {
        "type": "history reply",
        "messages": query('''
            SELECT message_id, sender_id, category, display_name, content
            FROM messages ORDER BY message_id DESC LIMIT 100
        ''')
    }


@register_handler("list events")
async def _ (account, message, websocket):
    return {"type": "event list", "events": list(event_groups.keys())}


async def unknown_request(account, message, websocket):
    return {"type": "error", "reason": "unknown request", "request": json.dumps(message)}


async def handle_connection(websocket, path):
    account = None

    while True:
        # Receive message
        try:
            msg = json.loads(await websocket.recv())
        except json.JSONDecodeError:
            msg = {}
        except:
            break
        msg_type = msg.get("type", "invalid")
        request_id = msg.get("request id", None)

        reply = None

        # Process message
        if msg_type == "auth":
            auth_token = msg.get("auth_token", None)
            if account:
                reply = {"type": "error", "reason": "already authenticated"}
            elif not auth_token:
                reply = {"type": "auth failure", "reason": "missing auth token"}
            else:
                try:
                    idinfo = id_token.verify_oauth2_token(auth_token, requests.Request(), GOOGLE_OAUTH_CLIENT_ID)

                    if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
                        raise ValueError('wrong issuer')

                    account = get_account(idinfo['sub'])
                    if account.user_name is None:
                        account.user_name = idinfo['email']
                        execute("UPDATE users SET user_name=%s WHERE user_id=%s", (idinfo['email'], account.user_id))
                        try:
                            await websocket.send(json.dumps({"type": "prompt username"}))
                        except:
                            break
                    reply = {"type": "auth success"}
                    connected_sockets.add(websocket)
                except ValueError as e:
                    reply = {"type": "auth failure", "reason": "invalid auth token, " + str(e)}
        elif msg_type == "invalid":
            reply = {"type": "error", "reason": "invalid message"}
        elif not account:
            reply = {"type": "error", "reason": "not authenticated"}
        else:
            try:
                handler = request_handlers[msg_type]
            except KeyError:
                handler = unknown_request

            reply = await handler(account, msg, websocket)

        # Send reply
        if reply is not None:
            if request_id is not None:
                reply['request id'] = request_id
            try:
                await websocket.send(json.dumps(reply))
            except:
                break

    connected_sockets.discard(websocket)


class Account:
    def __init__(self, google_id, user_id, user_name):
        self.google_id = google_id
        self.user_id = user_id
        self.user_name = user_name


@lru_cache(maxsize=64)
def get_account(google_id):
    result = single_query("SELECT user_id, user_name FROM users WHERE google_id=%s", (google_id,))
    if result:
        user_id, user_name = result
        return Account(google_id, user_id, user_name)
    else:
        execute("INSERT INTO users (google_id) VALUES (%s)", (google_id,))
        return get_account(google_id)


@lru_cache(maxsize=64)
def get_user_name(user_id):
    result = single_query("SELECT user_name FROM users WHERE user_id=%s", (user_id,))
    return result if result else "Unknown User"


file_signatures = {
    b"\x89\x50\x4E\x47": "img", # PNG
    b"\xFF\xD8\xFF\xDB": "img", # JPEG
    b"\xFF\xD8\xFF\xEE": "img", # JPEG
    b"\xFF\xD8\xFF\xE0": "img", # JPEG
    b"\xFF\xD8\xFF\xE1": "img", # JPEG
    b"<svg": "img"              # SVG
}
def sniff(file_data):
    magic_bytes = file_data[:4]
    result = file_signatures.get(magic_bytes, None)
    if result is not None:
        return result

    try:
        sample = file_data[:64].decode('utf-8')
        if all(c.isprintable() or c.isspace() for c in sample):
            return "txt"
    except:
        pass

    return "raw"


if __name__ == '__main__':
    main()
