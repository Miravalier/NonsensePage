#!/usr/bin/env python3.7

import asyncio
import ssl
import websockets
import json

connected_sockets = set()
event_groups = {}


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
    auth = False
    username = None

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
            username = msg.get("username", "")
            auth_token = msg.get("auth_token", "")
            if auth:
                reply = {"type": "error", "reason": "already authenticated"}
            elif not username:
                reply = {"type": "auth failure", "reason": "missing username"}
            elif not auth_token:
                reply = {"type": "auth failure", "reason": "missing auth token"}
            else:
                reply = {"type": "auth success"}
                auth = True
                connected_sockets.add(websocket)
        elif msg_type == "invalid":
            reply = {"type": "error", "reason": "invalid message"}
        elif not auth:
            reply = {"type": "error", "reason": "unauthorized"}
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
                    {"type": "event", "user": username, "id": event_id, "data": event_data},
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


if __name__ == '__main__':
    main()
