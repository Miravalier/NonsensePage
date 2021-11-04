import secrets
from typing import Dict, Optional, Union

from pydantic import BaseModel

from context import Context
from db import DatabaseEntry, db
from errors import ApiError
from fastapi import FastAPI, HTTPException, WebSocket
from models import ErrorReply, LoginRequest, RegisterRequest, User
from password import check_password, hash_password
from pydantic import ValidationError
from state import connected_websockets, sessions


async def handle_request(context: Context, request: Dict) -> Union[BaseModel, Dict]:
    if request["type"] == "register":
        await handle_register(context, RegisterRequest.parse_obj(request))
    else:
        await context.send


async def handle_register(context: Context, request: RegisterRequest) -> Union[BaseModel, Dict]:
    # Validate permissions
    if not context.user.is_gm:
        return ErrorReply()
    user = User(name=request.username, hashed_password=hash_password(request.password), is_gm=False)


app = FastAPI()


@app.get("/")
async def index():
    return {"status": "success"}


@app.get("/login")
async def login(request: LoginRequest):
    user_entry: Optional[DatabaseEntry] = db["users"][request.username]
    if user_entry is None:
        raise HTTPException(401, "invalid username or password")
    user = User.parse_obj(user_entry.data)
    if not check_password(request.password, user.hashed_password):
        raise HTTPException(401, "invalid username or password")
    token = secrets.token_hex(16)
    sessions[token] = user
    return {"status": "success", "token": token}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    context = Context(websocket)
    try:
        await context.authenticate()
        connected_websockets.add(context)
        while True:
            request = await context.receive()
            response = handle_request(context, request)
            if response:
                await context.send(response)
    except (ValidationError, ApiError) as e:
        await context.send(ErrorReply(description=str(e)))
    finally:
        connected_websockets.discard(context)
