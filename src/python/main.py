import secrets
from dataclasses import dataclass
from fastapi import FastAPI, Request, WebSocket
from fastapi.responses import JSONResponse
from pathlib import Path
from pydantic import BaseModel, Field, validator
from typing import Dict, Optional

import files
from database import db, User
from enums import Language, Permissions
from errors import AuthError, EntityError
from messages import messages
from security import check_password


@dataclass
class Subscriber:
    user: User
    websocket: WebSocket

    async def send(self, jsonable):
        await self.websocket.send_json(jsonable)


FILES_ROOT = Path("/files")


app = FastAPI()


@app.exception_handler(AuthError)
async def auth_error_handler(request: Request, exc: AuthError):
    return JSONResponse(status_code=401, content={
        "status": "error",
        "reason": str(exc)
    })


@app.exception_handler(EntityError)
async def entity_error_handler(request: Request, exc: EntityError):
    return JSONResponse(status_code=400, content={
        "status": "error",
        "reason": str(exc)
    })


def require(expr: bool, message: str = "insufficient permissions"):
    if not expr:
        raise AuthError(message)


class LoginRequest(BaseModel):
    username: str
    password: str


@app.post("/api/login")
async def login(request: LoginRequest):
    # Find the requested user by username
    user = db.users_by_name.get(request.username, None)
    if user is None:
        raise AuthError("invalid username or password")

    # Check the password
    if not check_password(request.password, user.hashed_password):
        raise AuthError("invalid username or password")

    # Generate a token and create a session
    token = secrets.token_hex(16)
    user.add_collection("users_by_token", token)
    return {"status": "success", "token": token, "gm": user.is_gm}


class AuthRequest(BaseModel):
    requester: User = Field(alias="token", exclude=True)

    @validator('requester', pre=True)
    def resolve_requester(cls, value):
        user = db.users_by_token.get(value, None)
        if user is None:
            raise AuthError("invalid username or password")
        return user


class SendMessageRequest(AuthRequest):
    speaker: str
    content: str
    character_id: Optional[str]
    language: Language = Language.COMMON


@app.post("/api/messages/send")
async def send_message(request: SendMessageRequest):
    # Permissions checks
    if not request.requester.is_gm:
        if request.character_id is not None:
            character = db.characters[request.character_id]
            require(character.has_permission(request.requester.id, field="speak", level=Permissions.WRITE))
            require(request.speaker == character.name)
            require(request.language in character.languages)
        else:
            require(request.speaker == request.requester.name)
            require(request.language == Language.COMMON)
    # Create message
    message = messages.create(
        speaker=request.speaker,
        content=request.content,
        character_id=request.character_id,
        language=request.language
    )
    # Inform subscribers
    full_broadcast = message.dict()
    full_broadcast["type"] = "send"
    foreign_broadcast = message.foreign_dict()
    foreign_broadcast["type"] = "send"
    for subscriber in MESSAGE_SUBSCRIBERS.values():
        if request.language in subscriber.user.languages:
            await subscriber.send(full_broadcast)
        else:
            await subscriber.send(foreign_broadcast)
    return {"status": "success", "id": message.id}


@app.post("/api/messages/recent")
async def recent_messages(request: AuthRequest):
    languages = request.requester.languages
    return {
        "status": "success",
        "messages": [
            (
                message.dict()
                if message.language in languages else
                message.foreign_dict()
            )
            for message in messages.recent
            if not message.is_deleted
        ]
    }


class EditMessageRequest(AuthRequest):
    index: int
    page: int
    content: str


@app.post("/api/messages/edit")
async def edit_message(request: EditMessageRequest):
    require(request.requester.is_gm)
    message = messages.get(request.page, request.index)
    message.edit(request.content)
    broadcast = {"type": "edit", "id": message.id, "content": message.content}
    for subscriber in MESSAGE_SUBSCRIBERS.values():
        await subscriber.send(broadcast)
    return {"status": "success"}


class DeleteMessageRequest(AuthRequest):
    index: int
    page: int


@app.post("/api/messages/delete")
async def delete_message(request: DeleteMessageRequest):
    require(request.requester.is_gm)
    message = messages.get(request.page, request.index)
    message.delete()
    broadcast = {"type": "delete", "id": message.id}
    for subscriber in MESSAGE_SUBSCRIBERS.values():
        await subscriber.send(broadcast)
    return {"status": "success"}


MESSAGE_SUBSCRIBERS: Dict[str, Subscriber] = {}
@app.websocket("/api/messages/subscribe")
async def message_subscription(websocket: WebSocket):
    print("/api/messages/subscribe - Headers -", websocket.headers)
    await websocket.accept()

    MESSAGE_SUBSCRIBERS[id(websocket)] = Subscriber(None, websocket)
    try:
        while True:
            request = await websocket.receive_json()
            print("/api/messages/subscribe - Request -", request)
    except:
        del MESSAGE_SUBSCRIBERS[id(websocket)]


@app.post("/api/status")
async def status(request: AuthRequest):
    return {"status": "success", "username": request.requester.name, "gm": request.requester.is_gm}


class ListFilesRequest(AuthRequest):
    path: str


@app.post("/api/files/list")
async def list_files(request: ListFilesRequest):
    # Make sure path is absolute
    path = Path(request.path)
    if not path.is_absolute():
        return {"status": "error", "reason": "not an absolute path"}
    # Resolve '..' and symlinks in path
    path = path.resolve(strict=False)
    # Make path relative to user root
    if request.requester.is_gm:
        user_root = FILES_ROOT
    else:
        user_root = FILES_ROOT / request.requester.name
    path = user_root / Path(str(path)[1:])
    # Check that path is a directory that exists
    if not path.is_dir():
        return {"status": "error", "reason": "not a directory"}
    # Get list of files
    if path == user_root:
        returned_path = "/"
    else:
        returned_path = "/" + str(path.relative_to(user_root))
    return {
        "status": "success",
        "path": returned_path,
        "files": [
            (
                files.sniff(subpath),
                "/" + str(subpath.relative_to(user_root))
            )
            for subpath in path.iterdir()
        ]
    }


@app.on_event("shutdown")
async def shutdown():
    print("Saving database ...")
    db.save()
