#!/usr/bin/env python3.7
import asyncio
import datetime
import secrets
import ssl
import websockets
import json
import psycopg2 as psql
import uuid
import sys
import os
import textwrap
import re
import hashlib
from pathlib import Path
from contextlib import contextmanager
from google.oauth2 import id_token
from google.auth.transport import requests
from functools import lru_cache, partial
from decimal import Decimal

# Constants
SUCCESS = {"type": "success"}
PERMISSION_DENIED = {"type": "error", "reason": "permission denied"}
INVALID_PARAMETERS = {"type": "error", "reason": "invalid parameters"}
ATTR_NUMBER =  0b000
ATTR_STRING =  0b001
ATTR_ENTITY =  0b010
ATTR_UNUSED =  0b011
ATTR_TYPE   =  0b011
ATTR_ARRAY  =  0b100
DENIED = 0
READ = 1
WRITE = 2
ADMIN = 3

attr_type_map = {
    ATTR_NUMBER: "numeric_attrs",
    ATTR_STRING: "string_attrs",
    ATTR_ENTITY: "entity_attrs"
}

attr_defaults = {
    ATTR_NUMBER: 0,
    ATTR_STRING: "",
    ATTR_ENTITY: 0
}

# Configuration
upload_root = Path("/var/www/miravalier/content/")

with open("/etc/oauth/oauth.json") as fp:
    GOOGLE_OAUTH = json.load(fp)
    GOOGLE_OAUTH_CLIENT_ID = GOOGLE_OAUTH['CLIENT_ID']

# Mutable Globals
connected_sockets = set()
request_handlers = {}
pending_blobs = {}
roll_id = 0


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


##########
# Random #
##########

MULTIPLIER = 6364136223846793005
INCREMENT  = 1442695040888963407
MASK32 = 2**32 - 1
MASK64 = 2**64 - 1


def rotr32(x, r):
	return (x >> r | x << (-r & 31)) & MASK32


class PCG:
    def __init__(self, seed=None):
        if seed is not None:
            self.state = (seed + INCREMENT) & MASK64
            self.next()

    # Returns [0, 2**32)
    def next(self):
        value = self.state
        count = value >> 59

        self.state = (value * MULTIPLIER + INCREMENT) & MASK64
        value ^= value >> 18
        return rotr32((value >> 27) & MASK32, count)

    # Returns [min, max]
    def between(self, min, max):
        return self.below(max+1-min) + min

    # Returns [0, limit)
    def below(self, limit):
        reroll_threshold = MASK32 - MASK32 % limit

        value = self.next()
        while value >= reroll_threshold:
            value = self.next()

        return value % limit

    def child(self):
        return PCG((self.next() << 32) | self.next())

    def clone(self):
        pcg = PCG()
        pcg.state = self.state
        return pcg


############
# Handlers #
############

def register_handler(message_type):
    def sub_register_handler(func):
        request_handlers[message_type] = func
        return func
    return sub_register_handler


def register_binary_handler(message_type, callback):
    def sub_register_binary_handler(func):
        async def wrapper(account, message, websocket):
            # Make sure the message has a request id
            request_id = message.get("request id", None)
            if request_id is None:
                return INVALID_PARAMETERS

            # Call the wrapped function
            reply = await func(account, message, websocket)

            # If the message has fully arrived, trigger the callback
            blob = pending_blobs[request_id]
            if blob.get("chunk count", -1) == len(blob["chunks"]):
                callback_reply = await callback(account, message, websocket)
                del pending_blobs[request_id]
                if callback_reply is not None:
                    callback_reply["request id"] = request_id
                    await websocket.send(json.dumps(callback_reply))
            # Save the callback if the message has not arrived
            else:
                blob["callback"] = callback

            # Return the wrapped function's reply to main handler
            return reply
        request_handlers[message_type] = wrapper
        return wrapper
    return sub_register_binary_handler


async def file_upload_callback(account, message, websocket):
    request_id = message["request id"]
    file_part = pending_blobs[request_id]
    file_name = file_part["name"]
    file_type = sniff(file_part["chunks"][0])
    directory_id = file_part["directory id"]

    if account.permission(directory_id) < WRITE:
        return PERMISSION_DENIED

    file_uuid = str(uuid.uuid4()) + file_extensions[file_type]

    with open(upload_root / file_uuid, "wb") as fp:
        for chunk in file_part["chunks"]:
            fp.write(chunk)

    execute("""
        INSERT INTO files (file_name, file_type, owner_id, parent_id, file_uuid)
        VALUES (%s, %s, %s, %s, %s)
    """, (file_name, file_type, account.user_id, directory_id, file_uuid))

    await broadcast({"type": "update file", "file id": directory_id, "user id": account.user_id})


def resolve_dice(generator, match):
    rolls = match.group(1)
    if rolls is None:
        rolls = 1
    else:
        rolls = int(rolls)
    sides = int(match.group(2))
    result = 0
    while rolls:
        result += generator.below(sides) + 1
        rolls -= 1
    return str(result)


def resolve_parens(generator, match):
    return str(resolve_formula(match.group(1), generator))


paren_group_regex = re.compile(r"\(([^()]*)\)")
dice_regex = re.compile(r"([0-9]*)d([0-9]+)")
formula_characters = set("0123456789+-*%^&|/")
def resolve_formula(formula, generator):
    # Make sure the parentheses are matched
    open_parens = formula.count('(')
    close_parens = formula.count(')')
    if open_parens != close_parens:
        raise ValueError("mismatched parentheses")

    # Resolve all parentheses
    while open_parens:
        formula = paren_group_regex.sub(partial(resolve_parens, generator), formula)
        open_parens = formula.count('(')

    # Resolve all dice
    formula = dice_regex.sub(partial(resolve_dice, generator), formula)

    # Validate formula before eval
    if any(c not in formula_characters for c in formula):
        raise ValueError("invalid formula")

    return eval(formula)


@register_handler("get seed")
async def _ (account, message, websocket):
    formula_hash = message.get("formula hash", None)
    roll_id = message.get("id", None)

    if formula_hash is None or roll_id is None:
        return INVALID_PARAMETERS

    seed = secrets.randbits(64)
    seed_salt = secrets.token_bytes(8)

    hasher = hashlib.sha256()
    hasher.update(seed_salt)
    hasher.update(seed.to_bytes(8, 'big'))
    seed_hash = hasher.hexdigest()

    await broadcast({
        "type": "roll",
        "id": roll_id,
        "formula hash": formula_hash,
        "seed hash": seed_hash
    })

    return {
        "type": "seed",
        "salt": seed_salt,
        "seed": seed
    }


@register_handler("init attr")
async def _ (account, message, websocket):
    entity_id = message.get("entity", None)
    attr = message.get("attrs", None)
    if entity_id is None or type(attr) != list or len(attr) != 2:
        return INVALID_PARAMETERS

    if account.permission(entity_id) < WRITE:
        return PERMISSION_DENIED

    attr_name, attr_type = attr
    if isinstance(attr_type, list):
        attr_type, _ = attr_type
    attr_array = attr_type & ATTR_ARRAY != 0
    attr_type &= ATTR_TYPE
    if attr_type not in attr_type_map:
        return {"type": "error", "reason": "unknown attr type '{}'".format(attr_type)}
    if not attr_array:
        execute("""
            INSERT INTO {} (attr_name, attr_value, entity_id)
            VALUES (%s, %s, %s)
        """.format(attr_type_map[attr_type]), (attr_name, attr_defaults[attr_type], entity_id))


@register_handler("init attrs")
async def _ (account, message, websocket):
    entity_id = message.get("entity", None)
    attrs = message.get("attrs", None)
    if entity_id is None or type(attrs) is not dict:
        return INVALID_PARAMETERS

    if account.permission(entity_id) < WRITE:
        return PERMISSION_DENIED

    for attr_name, attr_type in attrs.items():
        if isinstance(attr_type, list):
            attr_type, _ = attr_type
        attr_array = attr_type & ATTR_ARRAY != 0
        attr_type &= ATTR_TYPE
        if attr_type not in attr_type_map:
            return {"type": "error", "reason": "unknown attr type '{}'".format(attr_type)}
        if not attr_array:
            execute("""
                INSERT INTO {} (attr_name, attr_value, entity_id)
                VALUES (%s, %s, %s)
            """.format(attr_type_map[attr_type]), (attr_name, attr_defaults[attr_type], entity_id))


@register_handler("get attr")
async def _ (account, message, websocket):
    entity_id = message.get("entity", None)
    attr = message.get("attr", None)
    if entity_id is None or type(attr) is not list or len(attr) != 2:
        return INVALID_PARAMETERS

    if account.permission(entity_id) < READ:
        return PERMISSION_DENIED

    attr_name, attr_type = attr

    if isinstance(attr_type, list):
        attr_type, _ = attr_type
    attr_array = attr_type & ATTR_ARRAY != 0
    attr_type &= ATTR_TYPE
    if attr_type not in attr_type_map:
        return {"type": "error", "reason": "unknown attr type '{}'".format(attr_type)}
    if attr_array:
        result = [v[0] if v is not None else None for v in query("""
            SELECT attr_value FROM {} WHERE attr_name=%s AND entity_id=%s
        """.format(attr_type_map[attr_type]), (attr_name, entity_id))]
    else:
        result = single_query("""
            SELECT attr_value FROM {} WHERE attr_name=%s AND entity_id=%s
        """.format(attr_type_map[attr_type]), (attr_name, entity_id))
    if isinstance(result, Decimal):
        result = float(result)

    return {"type": "attr", "result": result}


@register_handler("set attr")
async def _ (account, message, websocket):
    entity_id = message.get("entity", None)
    attr = message.get("attr", None)
    if entity_id is None or type(attr) is not list or len(attr) != 3:
        return INVALID_PARAMETERS

    if account.permission(entity_id) < WRITE:
        return PERMISSION_DENIED

    attr_name, attr_type, attr_value = attr

    if isinstance(attr_type, list):
        attr_type, _ = attr_type
    attr_array = attr_type & ATTR_ARRAY != 0
    attr_type &= ATTR_TYPE
    if attr_type not in attr_type_map:
        return {"type": "error", "reason": "unknown attr type '{}'".format(attr_type)}

    try:
        if attr_array:
            execute("""
                DELETE FROM {} WHERE attr_name=%s AND entity_id=%s
            """.format(attr_type_map[attr_type]), (attr_name, entity_id))
            for sub_value in attr_value:
                execute("""
                    INSERT INTO {} (attr_name, attr_value, entity_id)
                    VALUES (%s, %s, %s)
                """.format(attr_type_map[attr_type]), (attr_name, attr_value, entity_id))
        else:
            execute("""
                UPDATE {} SET attr_value=%s WHERE attr_name=%s AND entity_id=%s
            """.format(attr_type_map[attr_type]), (attr_value, attr_name, entity_id))

        await broadcast({"type": "attr change", "origin": account.user_id, "entity": entity_id, "attr": attr_name})
        return SUCCESS
    except:
        return {"type": "error", "reason": "invalid attribute value"}


@register_handler("set attrs")
async def _ (account, message, websocket):
    entity_id = message.get("entity", None)
    attrs = message.get("attrs", None)
    if entity_id is None or attrs is None:
        return INVALID_PARAMETERS

    if account.permission(entity_id) < WRITE:
        return PERMISSION_DENIED

    try:
        for attr_name, attr_type, attr_value in attrs:
            if isinstance(attr_type, list):
                attr_type, _ = attr_type
            attr_array = attr_type & ATTR_ARRAY != 0
            attr_type &= ATTR_TYPE
            if attr_type not in attr_type_map:
                return {"type": "error", "reason": "unknown attr type '{}'".format(attr_type)}
            if attr_array:
                execute("""
                    DELETE FROM {} WHERE attr_name=%s AND entity_id=%s
                """.format(attr_type_map[attr_type]), (attr_name, entity_id))
                for sub_value in attr_value:
                    execute("""
                        INSERT INTO {} (attr_name, attr_value, entity_id)
                        VALUES (%s, %s, %s)
                    """.format(attr_type_map[attr_type]), (attr_name, attr_value, entity_id))
            else:
                execute("""
                    UPDATE {} SET attr_value=%s WHERE attr_name=%s AND entity_id=%s
                """.format(attr_type_map[attr_type]), (attr_value, attr_name, entity_id))
            await broadcast({"type": "attr change", "origin": account.user_id, "entity": entity_id, "attr": attr_name})
        return SUCCESS
    except:
        return {"type": "error", "reason": "invalid attribute value"}


@register_handler("activate file")
async def _ (account, message, websocket):
    file_id = message.get("id", None)
    if file_id is None:
        return INVALID_PARAMETERS
    if not account.admin:
        return PERMISSION_DENIED
    execute("UPDATE files SET active=TRUE WHERE file_id=%s", (file_id,))


@register_handler("deactivate file")
async def _ (account, message, websocket):
    file_id = message.get("id", None)
    if file_id is None:
        return INVALID_PARAMETERS
    if not account.admin:
        return PERMISSION_DENIED
    execute("UPDATE files SET active=FALSE WHERE file_id=%s", (file_id,))


@register_handler("active files")
async def _ (account, message, websocket):
    file_type = message.get("filetype", None)
    if file_type is None:
        return {
            "type": "active files",
            "files": query("SELECT file_id, file_name FROM files WHERE active=TRUE")
        }
    else:
        return {
            "type": "active files",
            "files": query(
                "SELECT file_id, file_name FROM files WHERE active=TRUE AND file_type=%s",
                (file_type,)
            )
        }


file_templates = {
    "entity schema": textwrap.dedent("""
        //ENTITY-SCHEMA
        import * as Entity from "/res/dnd/entity.js";

        export default class {0} extends Entity.Entity {{
            /* Method Overrides */
            //init()                  {{}}
            //on_viewer_open()        {{}}
            //on_map_select()         {{}}
            //on_map_drop(e)          {{}} // e: source_map, target_map
            //on_change_attribute(e)  {{}} // e: attr, old_value, new_value
        }}

        /* Property Overrides */
        {0}.prototype.attributes = {{
            "hp": Entity.ATTR_NUMBER
        }};

        {0}.prototype.layout = [];
    """).lstrip(),
    "txt": ""
}
file_extensions = {
    "entity schema": ".js",
    "txt": ".txt",
    "raw": ".raw",
    "img": ".img"
}
@register_handler("create file")
async def _ (account, message, websocket):
    parent_id = message.get("id", None)
    file_type = message.get("filetype", None)
    file_name = message.get("name", None)
    if parent_id is None or file_type is None or file_name is None:
        return INVALID_PARAMETERS

    if account.permission(parent_id) < WRITE:
        return PERMISSION_DENIED

    if file_type in file_templates:
        file_uuid = str(uuid.uuid4()) + file_extensions[file_type]
        with open(upload_root / file_uuid, "w") as fp:
            fp.write(file_templates[file_type].format(file_name.replace(" ","")))
    else:
        file_uuid = None

    file_id = execute_and_return("""
        INSERT INTO files (file_name, file_type, owner_id, parent_id, file_uuid)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING file_id
    """, (file_name, file_type, account.user_id, parent_id, file_uuid))[0]

    await broadcast({"type": "update file", "file id": parent_id, "user id": account.user_id})
    return {"type": "new file", "id": file_id}


@register_handler("create entity")
async def _ (account, message, websocket):
    parent_id = message.get("id", None)
    schema = message.get("schema", None)
    entity_name = message.get("name", None)
    if parent_id is None or schema is None or entity_name is None:
        return INVALID_PARAMETERS

    if account.permission(parent_id) < WRITE:
        return PERMISSION_DENIED

    if isinstance(schema, int):
        schema_id = single_query(
            "SELECT file_id FROM files WHERE file_id=%s AND file_type=%s",
            (schema, "entity schema")
        )
    elif isinstance(schema, str):
        schema_id = single_query(
            "SELECT file_id FROM files WHERE file_name=%s AND file_type=%s",
            (schema, "entity schema")
        )
    else:
        return {"type": "error", "reason": "invalid schema type"}

    if not schema_id:
        return {"type": "error", "reason": "invalid schema value"}

    file_id = execute_and_return("""
        INSERT INTO files (file_name, file_type, owner_id, parent_id)
        VALUES (%s, %s, %s, %s)
        RETURNING file_id
    """, (entity_name, "entity", account.user_id, parent_id))[0]

    execute("""
        INSERT INTO entities (entity_id, schema_id)
        VALUES (%s, %s)
    """, (file_id, schema_id))

    await broadcast({"type": "update file", "file id": parent_id, "user id": account.user_id})

    return {"type": "new entity", "id": file_id}


@register_handler("move file")
async def _ (account, message, websocket):
    file_id = message.get("id", None)
    destination = message.get("destination", None)
    if file_id is None or destination is None:
        return INVALID_PARAMETERS

    if file_id == destination:
        return {"type": "error", "reason": "a file cannot be its own parent"}

    if account.permission(file_id) < WRITE or account.permission(destination) < WRITE:
        return PERMISSION_DENIED

    parent_id = single_query("SELECT parent_id FROM files WHERE file_id=%s", (file_id,))

    execute("UPDATE files SET parent_id=%s WHERE file_id=%s", (destination, file_id))

    await broadcast({"type": "update file", "file id": parent_id, "user id": account.user_id})
    await broadcast({"type": "update file", "file id": destination, "user id": account.user_id})


@register_handler("download file")
async def _ (account, message, websocket):
    file_id = message.get("id", None)
    request_id = message.get("request id", None)
    if file_id is None or request_id is None:
        return INVALID_PARAMETERS

    if account.permission(file_id) < READ:
        return PERMISSION_DENIED

    try:
        file_type, file_uuid = single_query("SELECT file_type, file_uuid FROM files WHERE file_id=%s", (file_id,))
    except:
        return {"type": "error", "reason": "file id {} does not exist".format(file_id)}
    if file_uuid is None:
        return {"type": "error", "reason": "id {} not backed by file".format(file_id)}

    with open(upload_root / file_uuid, "rb") as fp:
        file_data = request_id.to_bytes(4, 'big') + fp.read()

    await websocket.send(file_data)


@register_binary_handler("upload file", file_upload_callback)
async def _ (account, message, websocket):
    file_name = message.get("name", None)
    directory_id = message.get("id", None)
    chunk_count = message.get("chunk count", None)

    if file_name is None or directory_id is None or type(chunk_count) is not int:
        return INVALID_PARAMETERS

    if account.permission(directory_id) < WRITE:
        return PERMISSION_DENIED

    if chunk_count > 160:
        return {"type": "error", "reason": "file too large"}

    request_id = message["request id"]

    blob = {
        "name": file_name,
        "directory id": directory_id,
        "chunk count": chunk_count
    }

    # Some chunks have arrived already
    if request_id in pending_blobs:
        pending_blobs[request_id].update(blob)
    # No chunks have arrived yet
    else:
        blob["chunks"] = []
        pending_blobs[request_id] = blob


@register_handler("binary")
async def _ (account, message, websocket):
    request_id = message.get("request id", None)
    chunk_data = message.get("data", None)

    if request_id is None or chunk_data is None:
        return INVALID_PARAMETERS

    if request_id in pending_blobs:
        blob = pending_blobs[request_id]
    else:
        blob = {"chunks": []}
        pending_blobs[request_id] = blob

    blob["chunks"].append(chunk_data)
    if blob.get("chunk count", -1) == len(blob["chunks"]):
        callback_reply = await blob["callback"](account, message, websocket)
        del pending_blobs[request_id]
        if callback_reply is not None:
            callback_reply["request id"] = request_id
            await websocket.send(json.dumps(callback_reply))


@register_handler("list schema")
async def _ (account, message, websocket):
    return {
        "type": "list schema",
        "schemas": query("SELECT file_id, file_name FROM files WHERE file_type='entity schema'")
    }


@register_handler("get schema")
async def _ (account, message, websocket):
    entity_id = message.get("entity id", None)
    schema_id = message.get("schema id", None)
    schema_name = message.get("schema name", None)

    if account.permission(entity_id) < READ:
        return PERMISSION_DENIED

    if entity_id is not None:
        try:
            schema_id, schema_uuid = single_query(
                """
                SELECT file_id, file_uuid
                FROM entities JOIN files
                ON schema_id=file_id
                WHERE entity_id=%s
                """,
                (entity_id,)
            )
        except:
            raise ValueError(repr(entity_id))
    elif schema_id is not None:
        schema_id, schema_uuid = single_query(
            "SELECT file_id, file_uuid FROM files WHERE file_id=%s",
            (schema_id,)
        )
    elif schema_name is not None:
        schema_id, schema_uuid = single_query(
            "SELECT file_id, file_uuid FROM files WHERE file_name=%s",
            (schema_name,)
        )
    else:
        return INVALID_PARAMETERS

    return {"type": "schema", "id": schema_id, "uuid": schema_uuid}


@register_handler("get uuid")
async def _ (account, message, websocket):
    file_id = message.get("id", None)
    if file_id is None or type(file_id) is not int:
        return INVALID_PARAMETERS

    if account.permission(file_id) < READ:
        return PERMISSION_DENIED

    return {
        "type": "file uuid",
        "id": file_id,
        "uuid": single_query("SELECT file_uuid FROM files WHERE file_id=%s", (file_id,))
    }


@register_handler("get parent")
async def _ (account, message, websocket):
    file_id = message.get("id", None)
    if file_id is None:
        return INVALID_PARAMETERS

    if account.permission(file_id) < READ:
        return PERMISSION_DENIED

    return {
        "type": "file parent",
        "child": file_id,
        "parent": single_query("SELECT parent_id FROM files WHERE file_id=%s", (file_id,))
    }


@register_handler("ls")
async def _ (account, message, websocket):
    directory_id = message.get("id", None)
    if directory_id is None:
        return INVALID_PARAMETERS

    if account.permission(directory_id) < READ:
        return PERMISSION_DENIED

    return {
        "type": "directory listing",
        "nodes": query(
            """
                SELECT file_name, file_id, file_type, file_uuid FROM files
                WHERE parent_id=%s
            """,
            (directory_id,)
        )
    }


@register_handler("update file")
async def _ (account, message, websocket):
    file_id = message.get("id", None)
    file_content = message.get("content", None)
    if file_id is None or file_content is None:
        return INVALID_PARAMETERS

    if account.permission(file_id) < WRITE:
        return PERMISSION_DENIED

    file_uuid = single_query("SELECT file_uuid FROM files WHERE file_id=%s", (file_id,))
    if not file_uuid:
        return {"type": "error", "reason": "file not backed by uuid"}

    with open(upload_root / file_uuid, "w") as fp:
        fp.write(file_content)

    await broadcast({"type": "update file", "file id": file_id, "user id": account.user_id})


@register_handler("swap messages")
async def _ (account, message, websocket):
    ids = message.get("ids", None)
    if not isinstance(ids, list) or len(ids) != 2:
        return INVALID_PARAMETERS

    if not account.admin:
        return PERMISSION_DENIED

    first_id, second_id = ids

    first_message = single_query("""
        SELECT
            sender_id, permission_id, category, display_name,
            content, sent_time
        FROM messages WHERE message_id=%s
    """, (first_id,))

    second_message = single_query("""
        SELECT
            sender_id, permission_id, category, display_name,
            content, sent_time
        FROM messages WHERE message_id=%s
    """, (second_id,))

    execute("""
        UPDATE messages SET
            sender_id=%s, permission_id=%s, category=%s,
            display_name=%s, content=%s, sent_time=%s
        WHERE message_id=%s
    """, second_message + (first_id,))

    execute("""
        UPDATE messages SET
            sender_id=%s, permission_id=%s, category=%s,
            display_name=%s, content=%s, sent_time=%s
        WHERE message_id=%s
    """, first_message + (second_id,))

    await broadcast({"type": "swap messages", "ids": ids})


@register_handler("update username")
async def _ (account, message, websocket):
    new_name = message.get("name", None)
    if new_name is None:
        return INVALID_PARAMETERS
    account.user_name = new_name
    execute("UPDATE users SET user_name=%s WHERE user_id=%s", (new_name, account.user_id))
    get_user_name.cache_clear()
    await broadcast({"type": "username update", "id": account.user_id, "name": new_name})


@register_handler("query username")
async def _ (account, message, websocket):
    user_id = message.get("id", None)
    if user_id is None:
        return INVALID_PARAMETERS
    return {"type": "username update", "id": user_id, "name": get_user_name(user_id)}


@register_handler("delete file")
async def _ (account, message, websocket):
    file_id = message.get("id", None)
    if file_id is None:
        return INVALID_PARAMETERS

    if account.permission(file_id) < WRITE:
        return PERMISSION_DENIED

    parent_id, file_uuid, file_type = single_query(
        "SELECT parent_id, file_uuid, file_type FROM files WHERE file_id=%s",
        (file_id,)
    )
    delete_file(file_uuid, file_id, file_type)

    await broadcast({"type": "update file", "file id": parent_id, "user id": account.user_id})


def delete_file(file_uuid, file_id, file_type):
    # Recursively delete children
    children = query("SELECT file_uuid, file_id, file_type FROM files WHERE parent_id=%s", (file_id,))
    for child_uuid, child_id, child_type in children:
        delete_file(child_uuid, child_id, child_type)
    # Delete attached information
    if file_type == "entity schema":
        instances = query("""
            SELECT file_uuid, file_id, file_type
            FROM entities JOIN files ON entity_id=file_id
            WHERE schema_id=%s
        """, (file_id,))
        for child_uuid, child_id, child_type in instances:
            delete_file(child_uuid, child_id, child_type)
    if file_type == "entity":
        execute("DELETE FROM entities WHERE entity_id=%s", (file_id,))
        execute("DELETE FROM numeric_attrs WHERE entity_id=%s", (file_id,))
        execute("DELETE FROM string_attrs WHERE entity_id=%s", (file_id,))
        execute("DELETE FROM entity_attrs WHERE entity_id=%s", (file_id,))
    if file_uuid:
        os.unlink(str(upload_root / file_uuid))
    # Delete this file
    execute("DELETE FROM files WHERE file_id=%s", (file_id,))


@register_handler("add subfolder")
async def _ (account, message, websocket):
    directory_name = message.get("name", None)
    directory_id = message.get("id", None)
    if directory_name is None or directory_id is None:
        return INVALID_PARAMETERS

    execute("""
        INSERT INTO files (file_name, file_type, owner_id, parent_id)
        VALUES (%s, %s, %s, %s)
    """, (directory_name, "directory", account.user_id, directory_id))

    await broadcast({"type": "update file", "file id": directory_id, "user id": account.user_id})


@register_handler("rename file")
async def _ (account, message, websocket):
    file_name = message.get("name", None)
    file_id = message.get("id", None)
    if file_name is None or file_id is None:
        return INVALID_PARAMETERS

    execute("""
        UPDATE files SET file_name=%s WHERE file_id=%s
    """, (file_name, file_id))

    parent_id = single_query("SELECT parent_id FROM files WHERE file_id=%s", (file_id,))

    await broadcast({"type": "update file", "file id": parent_id, "user id": account.user_id})


@register_handler("chat message")
async def _ (account, message, websocket):
    text = message.get("text", "")
    category = message.get("category", "ooc")
    display_name = message.get("display name", account.user_name)

    sent_time = datetime.datetime.now()

    result = execute_and_return('''
        INSERT INTO messages (message_id, sender_id, category, display_name, content, sent_time)
        VALUES (DEFAULT, %s, %s, %s, %s, %s)
        RETURNING message_id
    ''', (account.user_id, category, display_name, text, sent_time))[0]

    await broadcast({
        "type": "chat message", "category": category, "display name": display_name,
        "id": result, "text": text, "timestamp": sent_time.utctimetuple(), "sender": account.user_id
    })


@register_handler("clear history")
async def _ (account, message, websocket):
    if not account.admin:
        return PERMISSION_DENIED
    execute("DELETE FROM messages")
    await broadcast({"type": "clear history"})


@register_handler("request history")
async def _ (account, message, websocket):
    return {
        "type": "history reply",
        "messages": [(a, b, c, d, e, f.utctimetuple()) for a, b, c, d, e, f in query('''
            SELECT message_id, sender_id, category, display_name, content, sent_time
            FROM messages ORDER BY message_id DESC LIMIT 100
        ''')]
    }


async def unknown_request(account, message, websocket):
    return {"type": "error", "reason": "unknown request", "request": json.dumps(message)}


async def handle_connection(websocket, path):
    try:
        await main_handler(websocket, path)
    finally:
        connected_sockets.discard(websocket)


async def main_handler(websocket, path):
    account = None

    while True:
        # Receive message
        try:
            frame = await websocket.recv()
        except websockets.exceptions.ConnectionClosedOK:
            break
        if isinstance(frame, str):
            try:
                msg = json.loads(frame)
            except json.JSONDecodeError:
                msg = {}
        elif isinstance(frame, bytes):
            if len(frame) < 8:
                raise ValueError("Frame smaller than minimum frame size of 8")
            frame = memoryview(frame)
            msg = {
                "type": "binary",
                "request id": int.from_bytes(frame[:4], 'big', signed=False),
                "chunk": int.from_bytes(frame[4:8], 'big', signed=False),
                "data": frame[8:]
            }
        else:
            raise TypeError("Unknown frame type '{}' from websocket.recv()".format(type(frame)))

        request_id = msg.get("request id", None)
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
                    if account.user_name is None:
                        account.user_name = idinfo['email']
                        execute("UPDATE users SET user_name=%s WHERE user_id=%s", (idinfo['email'], account.user_id))
                        await websocket.send(json.dumps({"type": "prompt username"}))
                    reply = {"type": "auth success", "id": account.user_id, "admin": account.admin}
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

        # Ensure requests have replies
        if request_id is not None:
            if reply is not None:
                reply['request id'] = request_id
            else:
                reply = {"type": "no reply", "request id": request_id}

        # Send reply
        if reply is not None:
            await websocket.send(json.dumps(reply))


class Account:
    def __init__(self, google_id, user_id, user_name, admin):
        self.google_id = google_id
        self.user_id = user_id
        self.user_name = user_name
        self.admin = admin

    def permission(self, file_id):
        return ADMIN


@lru_cache(maxsize=64)
def get_account(google_id):
    result = single_query("SELECT user_id, user_name, admin FROM users WHERE google_id=%s", (google_id,))
    if result:
        user_id, user_name, admin = result
        return Account(google_id, user_id, user_name, admin)
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
        sample = bytes(file_data[:64]).decode('utf-8')
        if sample.startswith("//ENTITY-SCHEMA"):
            return "entity schema"
        elif all(c.isprintable() or c.isspace() for c in sample):
            return "txt"
    except:
        pass

    return "raw"


if __name__ == '__main__':
    main()
