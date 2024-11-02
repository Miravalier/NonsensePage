from __future__ import annotations

import secrets
import starlette.websockets
import uvicorn
from datetime import datetime
from fastapi import FastAPI, Request, WebSocket
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Any

from .endpoints import ws_handlers
from .lib import database
from .lib.errors import AuthError, JsonError
from .lib.security import check_password
from .lib.utils import require
from .lib.presence import connected_users
from .models.database_models import User, Session, Connection, get_pool
from .models.request_models import AuthRequest, GMRequest
from .endpoints.admin import router as admin_router
from .endpoints.abilities import router as ability_router
from .endpoints.characters import router as character_router
from .endpoints.maps import router as map_router
from .endpoints.notes import router as notes_router
from .endpoints.users import router as user_router
from .endpoints.combat import router as combat_router
from .endpoints.messages import router as messages_router
from .endpoints.files import router as files_router
from .endpoints.folders import router as folder_router


app = FastAPI()


@app.exception_handler(AuthError)
async def auth_error_handler(request: Request, exc: AuthError):
    return JSONResponse(status_code=401, content={
        "status": "error",
        "reason": str(exc)
    })


@app.exception_handler(JsonError)
async def json_error_handler(request: Request, exc: JsonError):
    return JSONResponse(status_code=400, content={
        "status": "error",
        "reason": str(exc)
    })


app.include_router(admin_router, prefix="/admin")
app.include_router(ability_router, prefix="/api/ability")
app.include_router(character_router, prefix="/api/character")
app.include_router(combat_router, prefix="/api/combat")
app.include_router(files_router, prefix="/api/files")
app.include_router(notes_router, prefix="/api/note")
app.include_router(map_router, prefix="/api/map")
app.include_router(messages_router, prefix="/api/messages")
app.include_router(user_router, prefix="/api/user")
app.include_router(folder_router, prefix="/api/folder")


class LoginRequest(BaseModel):
    username: str
    password: str


@app.post("/api/login")
async def login(request: LoginRequest):
    # Find the requested user by username
    user: User = database.users.find_one({"name": request.username})
    if user is None:
        raise AuthError("invalid username or password")

    # Check the password
    if not check_password(request.password, user.hashed_password):
        raise AuthError("invalid username or password")

    # Generate a token and create a session
    auth_token = secrets.token_hex(16)
    database.sessions.create({
        "auth_token": auth_token,
        "user_id": user.id,
        "last_auth_date": datetime.utcnow(),
    })
    return {"status": "success", "token": auth_token, "user": user.model_dump()}


class ReAuthRequest(BaseModel):
    token: str


@app.post("/api/re-auth")
async def reauthenticate(request: ReAuthRequest):
    require(database.sessions.find_one_and_update(
        {"auth_token": request.token},
        {"$set": {"last_auth_date": datetime.utcnow()}}
    ))
    return {"status": "success"}


async def handle_ws_request(connection: Connection, request: dict[str, Any]):
    if not isinstance(request, dict):
        raise JsonError("invalid json request")
    message_type = request.get("type")
    if message_type == "heartbeat":
        return

    print("/api/live - Request -", request)

    if message_type == "subscribe":
        pool = get_pool(request)
        pool.add(connection)
        connection.pools.add(pool)
    elif message_type == "unsubscribe":
        pool = get_pool(request)
        pool.discard(connection)
        connection.pools.discard(pool)
    else:
        handler = ws_handlers.registered_handlers.get(message_type)
        if handler is None:
            raise JsonError("invalid request type")
        else:
            handler(connection, request)


@app.websocket("/api/live")
async def live_connection(websocket: WebSocket):
    # Accept the connection
    await websocket.accept()
    # Find the user
    while True:
        request: dict = await websocket.receive_json()
        if request.get("token"):
            break

    session: Session = database.sessions.find_one({"auth_token": request["token"]})
    if session is None:
        await websocket.close()
        return

    user: User = database.users.find_one(session.user_id)
    if user is None:
        await websocket.close()
        return

    print("/api/live - Handshake -", user.name)
    # Begin subscription loop
    connection = Connection(user, websocket)
    try:
        if user.id not in connected_users:
            connected_users[user.id] = 1
            await get_pool("users").broadcast({
                "type": "connect",
                "id": user.id,
            })
        else:
            connected_users[user.id] += 1
        while True:
            await handle_ws_request(connection, await websocket.receive_json())
    except starlette.websockets.WebSocketDisconnect:
        pass
    finally:
        # Remove this connection from all pools
        for pool in connection.pools:
            pool.discard(connection)
        # Send a presence notification
        connected_users[user.id] -= 1
        if connected_users[user.id] == 0:
            del connected_users[user.id]
            await get_pool("users").broadcast({
                "type": "disconnect",
                "id": user.id,
            })


@app.post("/api/status")
async def status(request: AuthRequest):
    return {
        "status": "success",
        "user": request.requester.model_dump(),
    }


class ShowWindowRequest(GMRequest):
    type: str
    data: Any


@app.post("/api/show/window")
async def show_window(request: ShowWindowRequest):
    await get_pool("show/window").broadcast({
        "user": request.requester.id,
        "type": request.type,
        "data": request.data,
    })
    return {"status": "success"}


if __name__ == '__main__':
    uvicorn.run(app, port=80, host="0.0.0.0")
