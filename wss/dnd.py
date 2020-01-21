#!/usr/bin/env python3.7

import postgres
import asyncio
import ssl
import websockets
import json
import psycopg2 as psql
from contextlib import contextmanager
from google.oauth2 import id_token
from google.auth.transport import requests


@contextmanager
def cursor():
    connection = psql.connect("dbname=dnd")
    cursor = connection.cursor()
    try:
        yield cursor
    finally:
        cursor.close()
        connection.commit()
        connection.close()

connected_sockets = set()
event_groups = {}

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
    await broadcast({"type": "debug", "data": msg})


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
                    reply = {"type": "auth success"}
                    connected_sockets.add(websocket)
                except ValueError as e:
                    reply = {"type": "auth failure", "reason": "invalid auth token, " + str(e)}
        elif msg_type == "invalid":
            reply = {"type": "error", "reason": "invalid message"}
        elif not account:
            reply = {"type": "error", "reason": "not authenticated"}
        elif msg_type == "register event":
            event_id = msg.get("id", None)
            if event_id in event_groups:
                event_groups[event_id].add(websocket)
            else:
                event_groups[event_id] = {websocket}
                await broadcast({"type": "event created", "id": event_id})
            reply = {"type": "event registered", "id": event_id}
        elif msg_type == "deregister event":
            event_id = msg.get("id", None)
            if event_id in event_groups:
                event_groups[event_id].discard(websocket)
                if not event_groups[event_id]:
                    del event_groups[event_id]
            else:
                reply = {"type": "error", "reason": "non-existent event id"}
        elif msg_type == "trigger event":
            event_id = msg.get("id", None)
            if event_id in event_groups:
                event_data = msg.get("data", None)
                await broadcast(
                    {"type": "event", "user": account.username, "id": event_id, "data": event_data},
                    event_groups[event_id]
                )
            else:
                reply = {"type": "error", "reason": "non-existent event id"}
        elif msg_type == "list events":
            reply = {"type": "event list", "events": list(event_groups.keys())}
        else:
            reply = {"type": "error", "reason": "unknown type '{}'".format(msg_type)}

        # Send reply
        if reply is not None:
            await websocket.send(json.dumps(reply))

    connected_sockets.discard(websocket)


def get_account(user_id):
    raise ValueError("account does not exist")


if __name__ == '__main__':
    main()
