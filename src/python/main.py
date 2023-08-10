from __future__ import annotations

import hashlib
import html
import os
import secrets
import shutil
import starlette.websockets
from datetime import datetime
from fastapi import FastAPI, Request, WebSocket, Form, UploadFile, File
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from hmac import compare_digest
from pathlib import Path
from pydantic import BaseModel, Field, validator
from typing import Dict, Optional, Any

import database
import files
import ws_handlers
from models import (
    Character, Item, User, Session,
    Connection, Combat, get_pool
)
from enums import Alignment, Language, Permissions
from errors import AuthError, JsonError
from messages import messages
from security import check_password, hash_password


ADMIN_HASH = hashlib.sha256(os.environ.get("ADMIN_TOKEN", "").encode()).digest()
FILES_ROOT = Path("/files")


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


def auth_require(expr: bool, message: str = "insufficient permission"):
    if not expr:
        raise AuthError(message)
    return expr


def require(expr, message: str = "unknown error"):
    if not expr:
        raise JsonError(message)
    return expr


def get_character(id: str) -> Character:
    return require(database.characters.get(id), "invalid character id")


def get_item(id: str) -> Item:
    return require(database.items.get(id), "invalid item id")


class AdminConsoleRequest(BaseModel):
    admin_token: str

    @validator('admin_token')
    def resolve_admin_token(cls, value: str):
        request_hash = hashlib.sha256(value.encode()).digest()
        if not compare_digest(ADMIN_HASH, request_hash):
            raise JsonError("invalid admin key")
        return value


class CreateAdminRequest(AdminConsoleRequest):
    username: str
    password: str


@app.post("/admin/create")
async def admin_create_request(request: CreateAdminRequest):
    if database.users.get({"name": request.username}):
        raise JsonError("username taken")
    user: User = database.users.create({"name": request.username, "hashed_password": hash_password(request.password), "is_gm": True})
    return {"status": "success", "id": user.id}


@app.post("/admin/list-users")
async def admin_create_request(request: AdminConsoleRequest):
    return {"status": "success", "users": [user.name for user in database.users.find()]}


class LoginRequest(BaseModel):
    username: str
    password: str


@app.post("/api/login")
async def login(request: LoginRequest):
    # Find the requested user by username
    user: User = database.users.get({"name": request.username})
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
    return {"status": "success", "token": auth_token, "gm": user.is_gm}


class AuthRequest(BaseModel):
    requester: User = Field(alias="token", exclude=True)

    @validator('requester', pre=True)
    def resolve_requester(cls, value):
        session: Session = database.sessions.get({"auth_token": value})
        if session is None:
            raise AuthError("invalid token")

        user: User = database.users.get(session.user_id)
        if user is None:
            raise AuthError("valid token for deleted user")

        return user


class GMRequest(BaseModel):
    requester: User = Field(alias="token", exclude=True)

    @validator('requester', pre=True)
    def resolve_requester(cls, value):
        session: Session = database.sessions.get({"auth_token": value})
        auth_require(session is not None, "invalid token")

        user: User = database.users.get(session.user_id)
        auth_require(user is not None, "valid token for deleted user")
        auth_require(user.is_gm, "insufficient permission, requires GM")

        return user


class UserCreateRequest(GMRequest):
    username: str
    password: str


@app.post("/api/user/create")
async def user_create(request: UserCreateRequest):
    if database.users.get({"name": request.username}):
        raise JsonError("username taken")
    user: User = database.users.create({"name": request.username, "hashed_password": hash_password(request.password)})
    return {"status": "success", "id": user.id}


class ItemDeleteRequest(AuthRequest):
    id: str


@app.post("/api/item/delete")
async def item_delete(request: ItemDeleteRequest):
    item: Item = database.items.get(request.id)
    if not request.requester.is_gm:
        auth_require(item.has_permission(request.requester.id, "*", Permissions.OWNER))
    database.items.delete(item.id)
    return {"status": "success"}


class CharacterCreateRequest(AuthRequest):
    name: str
    alignment: Optional[Alignment] = None


@app.post("/api/character/create")
async def character_create(request: CharacterCreateRequest):
    main_character = False
    if request.alignment is None:
        if request.requester.is_gm:
            request.alignment = Alignment.NEUTRAL
        elif request.requester.character_id is None:
            request.alignment = Alignment.PLAYER
            main_character = True
        else:
            request.alignment = Alignment.ALLY
    character = database.characters.create({"name": request.name, "alignment": request.alignment})
    if not request.requester.is_gm:
        character.set_permission(request.requester.id, "*", Permissions.OWNER)
        if main_character:
            request.requester.character_id = character.id
    return {"status": "success", "id": character.id}


class CharacterDeleteRequest(AuthRequest):
    id: str


@app.post("/api/character/delete")
async def character_delete(request: CharacterDeleteRequest):
    character = get_character(request.id)
    if not request.requester.is_gm:
        auth_require(character.has_permission(request.requester.id, "*", Permissions.OWNER))
    database.characters.delete(character.id)
    return {"status": "success"}


class CharacterUpdateRequest(AuthRequest):
    id: str
    changes: Dict


@app.post("/api/character/update")
async def character_update(request: CharacterUpdateRequest):
    character = get_character(request.id)
    if not request.requester.is_gm:
        auth_require(character.has_permission(request.requester.id, "*", Permissions.WRITE))

    database.characters.update(request.id, {"$set": request.changes})

    await character.broadcast_update(request.changes)
    return {"status": "success"}


class CharacterGetRequest(AuthRequest):
    id: str


@app.post("/api/character/get")
async def character_get(request: CharacterGetRequest):
    character = get_character(request.id)
    permission = request.requester.is_gm or character.has_permission(request.requester.id, "*", Permissions.READ)
    if permission:
        return {"status": "success", "character": character.dict()}
    else:
        return {
            "status": "partial",
            "character": {
                "name": character.name,
                "image": character.image,
                "sheet_type": character.sheet_type,
            },
        }


@app.post("/api/character/list")
async def character_list(request: AuthRequest):
    characters = []
    if request.requester.is_gm:
        for character in database.characters.find():
            characters.append((character.id, character.name))
    else:
        for character in database.characters.find():
            if character.has_permission(request.requester.id, level=Permissions.READ):
                characters.append((character.id, character.name))
    return {"status": "success", "characters": characters}


class NewCombatRequest(GMRequest):
    name: str


@app.post("/api/combat/create")
async def combat_new(request: NewCombatRequest):
    combat: Combat = database.combats.create({"name": request.name})
    return {
        "status": "success",
        "combat": combat.dict()
    }


class GetCombatRequest(AuthRequest):
    combat_id: str


@app.post("/api/combat/get")
async def combat_get(request: GetCombatRequest):
    combat = database.combats.get(request.combat_id)

    if combat is None:
        raise JsonError("invalid combat id")

    return {
        "status": "success",
        "combat": {
            "id": combat.id,
            "name": combat.name,
            "combatants": [
                {
                    "name": combatant.name,
                    "character_id": combatant.character_id,
                    "initiative": combatant.initiative
                }
                for combatant in combat.combatants
            ]
        }
    }


@app.post("/api/combat/list")
async def combat_list(request: AuthRequest):
    return {
        "status": "success",
        "combats": [
            combat.dict()
            for combat in database.combats.find()
        ],
    }


class RollRequest(AuthRequest):
    speaker: str
    formula: str
    character_id: Optional[str]


@app.post("/api/messages/roll")
async def send_roll(request: RollRequest):
    # Permissions checks
    if not request.requester.is_gm and request.character_id is not None:
        character: Character = require(database.characters.get(request.character_id), "character does not exist")
        auth_require(character.has_permission(request.requester.id, field="speak", level=Permissions.WRITE))
    # Create message
    message = messages.create(
        speaker=request.speaker,
        content="<p>TODO</p>",
        character_id=request.character_id,
    )
    # Inform subscribers
    broadcast = jsonable_encoder(message.dict())
    broadcast["type"] = "send"
    broadcast["pool"] = "messages"
    await get_pool("messages").broadcast(broadcast)
    return {"status": "success", "id": message.id}


class SendMessageRequest(AuthRequest):
    speaker: str
    content: str
    character_id: Optional[str] = None
    language: Language = Language.COMMON

    @validator('content')
    def escape_content(cls, value):
        return html.escape(value).replace('\n', '<br>')


@app.post("/api/messages/speak")
async def send_message(request: SendMessageRequest):
    # Permissions checks
    if not request.requester.is_gm:
        if request.character_id is not None:
            character = require(database.characters.get(request.character_id), "character does not exist")
            auth_require(character.has_permission(request.requester.id, field="speak", level=Permissions.WRITE))
            auth_require(request.speaker == character.name)
            auth_require(request.language in character.languages)
        else:
            auth_require(request.speaker == request.requester.name)
            auth_require(request.language == Language.COMMON)
    # Create message
    message = messages.create(
        speaker=request.speaker,
        content=f"<p>{request.content}</p>",
        character_id=request.character_id,
        language=request.language
    )
    # Inform subscribers
    full_broadcast = jsonable_encoder(message.dict())
    full_broadcast["type"] = "send"
    full_broadcast["pool"] = "messages"
    foreign_broadcast = jsonable_encoder(message.foreign_dict())
    foreign_broadcast["type"] = "send"
    foreign_broadcast["pool"] = "messages"
    for connection in get_pool("messages"):
        if request.language in connection.user.languages:
            await connection.send(full_broadcast)
        else:
            await connection.send(foreign_broadcast)
    return {"status": "success", "id": message.id}


@app.post("/api/messages/recent")
async def recent_messages(request: AuthRequest):
    languages = request.requester.languages
    return {
        "status": "success",
        "messages": [
            (
                message.dict()
                if message.language == Language.COMMON or message.language in languages else
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

    @validator('content')
    def escape_content(cls, value):
        return html.escape(value)


@app.post("/api/messages/edit")
async def edit_message(request: EditMessageRequest):
    auth_require(request.requester.is_gm)
    message = messages.get(request.page, request.index)
    message.edit(request.content)
    broadcast = {"pool": "messages", "type": "edit", "id": message.id, "content": message.content}
    for connection in get_pool("messages"):
        if message.language in connection.user.languages:
            await connection.send(broadcast)
    return {"status": "success"}


class DeleteMessageRequest(AuthRequest):
    index: int
    page: int


@app.post("/api/messages/delete")
async def delete_message(request: DeleteMessageRequest):
    auth_require(request.requester.is_gm)
    message = messages.get(request.page, request.index)
    message.delete()
    broadcast = {"pool": "messages", "type": "delete", "id": message.id}
    await get_pool("messages").broadcast(broadcast)
    return {"status": "success"}


async def handle_ws_request(connection: Connection, request: Dict[str, Any]):
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

    session: Session = database.sessions.get({"auth_token": request["token"]})
    if session is None:
        await websocket.close()
        return

    user: User = database.users.get(session.user_id)
    if user is None:
        await websocket.close()
        return

    print("/api/live - Handshake -", user.name)
    # Begin subscription loop
    connection = Connection(user, websocket)
    try:
        while True:
            await handle_ws_request(connection, await websocket.receive_json())
    except starlette.websockets.WebSocketDisconnect:
        pass
    finally:
        for pool in connection.pools:
            pool.discard(connection)


@app.post("/api/status")
async def status(request: AuthRequest):
    return {"status": "success", "username": request.requester.name, "gm": request.requester.is_gm}


def validate_path(requester: User, path: str) -> Path:
    # Make sure path is absolute
    path: Path = Path(path)
    if not path.is_absolute():
        raise JsonError("not an absolute path")
    # Resolve '..' and symlinks in path
    path = path.resolve(strict=False)
    # Make path relative to user root
    if requester.is_gm:
        user_root = FILES_ROOT
    else:
        user_root = FILES_ROOT / requester.name
    path = user_root / Path(str(path)[1:])
    # Check that path is a directory that exists
    if not path.exists():
        raise JsonError("path does not exist")
    return path


def validate_directory(requester: User, path: str) -> Path:
    # Make sure path is absolute
    path: Path = Path(path)
    if not path.is_absolute():
        raise JsonError("not an absolute path")
    # Resolve '..' and symlinks in path
    path = path.resolve(strict=False)
    # Make path relative to user root
    if requester.is_gm:
        user_root = FILES_ROOT
    else:
        user_root = FILES_ROOT / requester.name
    path = user_root / Path(str(path)[1:])
    # Check that path is a directory that exists
    if not path.is_dir():
        raise JsonError("not a directory")
    return path


class CreateFolderRequest(AuthRequest):
    path: str
    name: str


@app.post("/api/files/mkdir")
async def files_mkdir(request: CreateFolderRequest):
    path = validate_directory(request.requester, request.path)
    new_path = path / request.name
    new_path.mkdir()
    return {"status": "success"}


def recursive_delete(path: Path):
    if path.is_dir():
        for sub_path in list(path.iterdir()):
            recursive_delete(sub_path)
        path.rmdir()
    else:
        path.unlink(path)


class DeleteFileRequest(AuthRequest):
    path: str


@app.post("/api/files/delete")
async def delete_file(request: DeleteFileRequest):
    path = validate_path(request.requester, request.path)
    recursive_delete(path)
    return {"status": "success"}


@app.post("/api/files/upload")
async def upload_file(token: str = Form(...), path: str = Form(...), file: UploadFile = File(...)):
    session: Session = database.sessions.get({"auth_token": token})
    if session is None:
        raise AuthError("invalid token")

    requester: User = database.users.get(session.user_id)
    if requester is None:
        raise AuthError("valid token for deleted user")

    path = validate_directory(requester, path)

    # Copy file to permanent location
    with open(path / file.filename, "wb") as f:
        shutil.copyfileobj(file.file, f)

    return {"status": "success"}


class ListFilesRequest(AuthRequest):
    path: str


@app.post("/api/files/list")
async def list_files(request: ListFilesRequest):
    # Validate path
    path = validate_directory(request.requester, request.path)
    # Make path relative to user root
    if request.requester.is_gm:
        user_root = FILES_ROOT
    else:
        user_root = FILES_ROOT / request.requester.name
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
