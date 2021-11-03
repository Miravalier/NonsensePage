import secrets
from typing import Union
from fastapi import FastAPI, WebSocket
from pydantic import BaseModel, ValidationError

from user import User
from db import db


sessions = {}


class ErrorReply(BaseModel):
    description: str


class LoginRequest(BaseModel):
    username: str
    password: str


class AuthRequest(BaseModel):
    token: str


class Context:
    def __init__(self, websocket: WebSocket):
        self.websocket = websocket

    async def send(self, data: Union[dict, BaseModel]):
        if isinstance(data, BaseModel):
            await self.websocket.send_json(data.dict())
        else:
            await self.websocket.send_json(data)

    async def receive(self, model: BaseModel) -> BaseModel:
        return model.parse_obj(await self.websocket.receive_json())

    async def authenticate(self):
        auth_request: AuthRequest = await self.receive(AuthRequest)
        user = sessions.get(auth_request.token)


app = FastAPI()


@app.get("/")
async def index():
    return {"status": "success"}


@app.get("/login")
async def login(request: LoginRequest):
    request.username
    request.password
    token = secrets.token_hex(16)
    sessions[token] = user
    return {"status": "success"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    context = Context(websocket)
    try:
        await context.authenticate()
    except ValidationError as e:
        await context.send(ErrorReply(description=str(e)))
