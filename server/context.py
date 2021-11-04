from typing import Dict, Union

from errors import AuthError
from fastapi import WebSocket
from models import AuthRequest, User
from pydantic import BaseModel
from state import sessions


class Context:
    def __init__(self, websocket: WebSocket):
        self.websocket = websocket
        self.user: User = None

    async def send(self, data: Union[dict, BaseModel]):
        if isinstance(data, BaseModel):
            await self.websocket.send_json(data.dict())
        else:
            await self.websocket.send_json(data)

    async def receive(self, model: BaseModel = None) -> Union[BaseModel, Dict]:
        if model is None:
            return await self.websocket.receive_json()
        else:
            return model.parse_obj(await self.websocket.receive_json())

    async def authenticate(self):
        auth_request: AuthRequest = await self.receive(AuthRequest)
        self.user = sessions.get(auth_request.token)
        if self.user is None:
            raise AuthError("invalid or expired token")
