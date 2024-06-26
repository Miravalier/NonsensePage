from __future__ import annotations

import hashlib
import json
import os
import random
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
import expressions
import files
import ws_handlers
from models import (
    Character, Item, User, Session,
    Connection, Combat, Message,
    Folder, get_pool
)
from enums import Alignment, Language, Permissions
from errors import AuthError, JsonError
from security import check_password, hash_password
from utils import current_timestamp


ADMIN_HASH = hashlib.sha256(os.environ.get("ADMIN_TOKEN", "").encode()).digest()


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


def assert_no_mongo_operators(obj):
    objects_to_scan = [obj]
    while objects_to_scan:
        current_object = objects_to_scan.pop()
        if isinstance(current_object, dict):
            for key, value in current_object.items():
                if key.startswith("$"):
                    raise JsonError("Invalid changes - contains $ operator")
                objects_to_scan.append(value)
        elif isinstance(current_object, list):
            objects_to_scan.extend(current_object)
    return obj


async def send_message(content: str, *, user: User, speaker: str = "System", character_id: str = None, language = Language.COMMON):
    # Create message
    message: Message = database.messages.create({
        "sender_id": user.id,
        "character_id": character_id,
        "speaker": speaker,
        "content": content.strip(),
        "language": language,
        "timestamp": current_timestamp(),
    })
    # Inform subscribers
    full_broadcast = jsonable_encoder(message.model_dump())
    full_broadcast["type"] = "send"
    full_broadcast["pool"] = "messages"
    foreign_broadcast = jsonable_encoder(message.foreign_dict())
    foreign_broadcast["type"] = "send"
    foreign_broadcast["pool"] = "messages"
    for connection in get_pool("messages"):
        if language == Language.COMMON or language in connection.user.languages:
            await connection.send(full_broadcast)
        else:
            await connection.send(foreign_broadcast)
    return message


def delete_character_folder(folder: Folder):
    # Delete the folder itself
    database.character_folders.delete_one(folder.id)
    # Delete all characters in this folder
    database.characters.delete_many({"folder_id": folder.id})
    # Recursively delete all child folders
    for subfolder in database.character_folders.find({"parent_id": folder.id}):
        delete_character_folder(subfolder)


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
    if database.users.find_one({"name": request.username}):
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


class AuthRequest(BaseModel):
    requester: User = Field(alias="token", exclude=True)

    @validator('requester', pre=True)
    def resolve_requester(cls, value):
        session: Session = database.sessions.find_one({"auth_token": value})
        auth_require(session is not None, "invalid token")

        user: User = database.users.find_one(session.user_id)
        auth_require(user is not None, "valid token for deleted user")

        return user


class GMRequest(BaseModel):
    requester: User = Field(alias="token", exclude=True)

    @validator('requester', pre=True)
    def resolve_requester(cls, value):
        session: Session = database.sessions.find_one({"auth_token": value})
        auth_require(session is not None, "invalid token")

        user: User = database.users.find_one(session.user_id)
        auth_require(user is not None, "valid token for deleted user")
        auth_require(user.is_gm, "insufficient permission, requires GM")

        return user


class ReAuthRequest(BaseModel):
    token: str


@app.post("/api/re-auth")
async def reauthenticate(request: ReAuthRequest):
    require(database.sessions.find_one_and_update(
        {"auth_token": request.token},
        {"$set": {"last_auth_date": datetime.utcnow()}}
    ))
    return {"status": "success"}


class UserCreateRequest(GMRequest):
    username: str
    password: str


@app.post("/api/user/create")
async def user_create(request: UserCreateRequest):
    if database.users.find_one({"name": request.username}):
        raise JsonError("username taken")
    user: User = database.users.create({"name": request.username, "hashed_password": hash_password(request.password)})
    user.file_root.mkdir(parents=True, exist_ok=True)
    await get_pool("users").broadcast({
        "type": "create",
        "user": user.model_dump(),
    })
    return {"status": "success", "id": user.id}


class UserDeleteRequest(GMRequest):
    id: str


@app.post("/api/user/delete")
async def user_delete(request: UserDeleteRequest):
    if not database.users.delete_one(request.id):
        raise JsonError("No user exists with that id")

    await get_pool("users").broadcast({
        "type": "delete",
        "id": request.id,
    })

    return {"status": "success"}


@app.post("/api/user/list")
async def user_list(request: AuthRequest):
    return {"status": "success", "users": [user.model_dump() for user in database.users.find()]}


class ItemDeleteRequest(AuthRequest):
    id: str


@app.post("/api/item/delete")
async def item_delete(request: ItemDeleteRequest):
    item: Item = database.items.find_one(request.id)
    if item is None:
        raise JsonError("Invalid item id")
    if not request.requester.is_gm:
        auth_require(item.has_permission(request.requester.id, "*", Permissions.OWNER))
    database.items.delete_one(item.id)
    return {"status": "success"}


class CharacterMoveRequest(AuthRequest):
    character_id: Optional[str] = None
    folder_id: Optional[str] = None
    dst_id: Optional[str] = None


@app.post("/api/character/move")
async def character_move(request: CharacterMoveRequest):
    if request.dst_id is not None:
        dst_folder = require(database.character_folders.find_one(request.dst_id), "invalid folder id")
        if not request.requester.is_gm:
            auth_require(dst_folder.has_permission(request.requester.id, "*", Permissions.WRITE))

    require(request.character_id or request.folder_id, "no src specified")
    require(not (request.character_id and request.folder_id), "both folder and character ids specified")

    if request.character_id is not None:
        character = require(database.characters.find_one(request.character_id), "invalid character id")
        require(character.folder_id != request.dst_id, "src and dst folder must differ")
        if not request.requester.is_gm:
            auth_require(character.has_permission(request.requester.id, "*", Permissions.OWNER))
        database.characters.find_one_and_update(request.character_id, {"$set": {"folder_id": request.dst_id}})
        await character.pool.broadcast({
            "type": "move",
            "src": character.folder_id,
            "dst": request.dst_id,
        })
        await get_pool("characters").broadcast({
            "type": "move",
            "src": character.folder_id,
            "dst": request.dst_id,
            "id": character.id,
            "name": character.name,
            "image": character.image,
        })

    if request.folder_id is not None:
        require(request.folder_id != request.dst_id, "folder cannot contain itself")
        folder = require(database.character_folders.find_one(request.folder_id), "invalid folder id")
        require(folder.parent_id != request.dst_id, "src and dst folder must differ")
        if not request.requester.is_gm:
            auth_require(folder.has_permission(request.requester.id, "*", Permissions.OWNER))
        database.character_folders.find_one_and_update(request.folder_id, {"$set": {"parent_id": request.dst_id}})
        await get_pool("characters").broadcast({
            "type": "movedir",
            "src": folder.parent_id,
            "dst": request.dst_id,
            "id": folder.id,
            "name": folder.name,
        })
    return {"status": "success"}


class CharacterCreateRequest(AuthRequest):
    name: str
    alignment: Optional[Alignment] = None
    folder_id: Optional[str] = None


@app.post("/api/character/create")
async def character_create(request: CharacterCreateRequest):
    options = {"name": request.name}
    if request.alignment is None:
        if request.requester.is_gm:
            options["alignment"] = Alignment.NEUTRAL
        elif request.requester.character_id is None:
            options["alignment"] = Alignment.PLAYER
        else:
            options["alignment"] = Alignment.ALLY
    else:
        options["alignment"] = request.alignment
    if not request.requester.is_gm:
        options["permissions"] = {"*": {"*": Permissions.READ}, request.requester.id: {"*": Permissions.OWNER}}
    if request.folder_id is not None:
        folder = require(database.character_folders.find_one(request.folder_id), "invalid folder id")
        if not request.requester.is_gm:
            auth_require(folder.has_permission(request.requester.id, "*", Permissions.WRITE))
        options["folder_id"] = request.folder_id

    character = database.characters.create(options)

    if request.requester.character_id is None and character.alignment == Alignment.PLAYER:
        user = database.users.find_one_and_update(request.requester.id, {"$set": {"character_id": character.id}})
        await get_pool("users").broadcast({
            "type": "update",
            "user": user.model_dump(),
        })

    await get_pool("characters").broadcast({
        "type": "create",
        "folder": character.folder_id,
        "id": character.id,
        "name": character.name,
    })
    return {"status": "success", "id": character.id}


class CharacterDeleteRequest(AuthRequest):
    id: str


@app.post("/api/character/delete")
async def character_delete(request: CharacterDeleteRequest):
    character = require(database.characters.find_one(request.id), "invalid character id")
    if not request.requester.is_gm:
        auth_require(character.has_permission(request.requester.id, "*", Permissions.OWNER))
    database.characters.delete_one(character.id)
    await character.pool.broadcast({
        "type": "delete",
    })
    await get_pool("characters").broadcast({
        "type": "delete",
        "folder": character.folder_id,
        "id": character.id,
    })
    return {"status": "success"}


class CharacterUpdateRequest(AuthRequest):
    id: str
    changes: Dict


@app.post("/api/character/update")
async def character_update(request: CharacterUpdateRequest):
    character = require(database.characters.find_one(request.id), "invalid character id")
    if not request.requester.is_gm:
        auth_require(character.has_permission(request.requester.id, "*", Permissions.WRITE))

    database.characters.find_one_and_update(request.id, request.changes)

    await character.broadcast_changes(request.changes)

    if name := request.changes.get("$set", {}).get("name", None):
        await get_pool("characters").broadcast({
            "type": "rename",
            "folder": character.folder_id,
            "id": request.id,
            "name": name,
        })

    return {"status": "success"}


class CharacterGetRequest(AuthRequest):
    id: str = None
    name: str = None


@app.post("/api/character/get")
async def character_get(request: CharacterGetRequest):
    if request.id is None and request.name is None:
        raise JsonError("get character by either id or name, passed neither")
    if request.id is not None and request.name is not None:
        raise JsonError("get character by either id or name, passed both")

    if request.id:
        character = require(database.characters.find_one(request.id), "invalid character id")
    else:
        character = require(database.characters.find_one({"name": request.name}), "invalid character name")

    permission = request.requester.is_gm or character.has_permission(request.requester.id, "*", Permissions.READ)
    if permission:
        return {"status": "success", "character": character.model_dump()}
    else:
        return {
            "status": "partial",
            "character": {
                "id": character.id,
                "name": character.name,
                "image": character.image,
                "sheet_type": character.sheet_type,
                "permissions": character.permissions,
                "size": character.size,
                "scale": character.scale,
            },
        }


class CharacterFolderRenameRequest(AuthRequest):
    id: str
    name: str


@app.post("/api/character/folder/rename")
async def character_folder_rename(request: CharacterFolderRenameRequest):
    folder = require(database.character_folders.find_one(request.id), "invalid folder id")
    if not request.requester.is_gm:
        auth_require(folder.has_permission(request.requester.id, "*", Permissions.OWNER))
    database.character_folders.find_one_and_update(request.id, {"$set": {"name": request.name}})
    await get_pool("characters").broadcast({
        "type": "renamedir",
        "folder": request.id,
        "name": request.name,
    })
    return {"status": "success"}


class CharacterFolderCreateRequest(AuthRequest):
    name: str
    parent: Optional[str] = None


@app.post("/api/character/folder/create")
async def character_folder_create(request: CharacterFolderCreateRequest):
    if request.parent is not None:
        require(database.character_folders.find_one(request.parent), "invalid folder id")
    options = {"name": request.name, "parent_id": request.parent}
    if not request.requester.is_gm:
        options["permissions"] = {"*": {"*": Permissions.READ}, request.requester.id: {"*": Permissions.OWNER}}
    folder = database.character_folders.create(options)
    await get_pool("characters").broadcast({
        "type": "mkdir",
        "folder": request.parent,
        "id": folder.id,
        "name": folder.name,
    })
    return {"status": "success", "id": folder.id}


class CharacterFolderDeleteRequest(AuthRequest):
    folder_id: str


@app.post("/api/character/folder/delete")
async def character_folder_delete(request: CharacterFolderDeleteRequest):
    folder = require(database.character_folders.find_one(request.folder_id), "invalid folder id")
    if not request.requester.is_gm:
        auth_require(folder.has_permission(request.requester.id, "*", Permissions.OWNER))
    delete_character_folder(folder)
    await get_pool("characters").broadcast({
        "type": "rmdir",
        "folder": folder.id,
    })
    return {"status": "success"}


class CharacterListRequest(AuthRequest):
    folder_id: Optional[str] = None


@app.post("/api/character/list")
async def character_list(request: CharacterListRequest):
    if request.folder_id is not None:
        folder = require(database.character_folders.find_one(request.folder_id), "invalid folder id")
        folder_name = folder.name
        parent_id = folder.parent_id
    else:
        folder_name = "/"
        parent_id = None
    subfolders = []
    characters = []
    if request.requester.is_gm:
        for folder in database.character_folders.find({"parent_id": request.folder_id}):
            subfolders.append((folder.id, folder.name))
        for character in database.characters.find({"folder_id": request.folder_id}):
            characters.append((character.id, character.name, character.image))

    else:
        for folder in database.character_folders.find({"parent_id": request.folder_id}):
            if folder.has_permission(request.requester.id, level=Permissions.READ):
                subfolders.append((folder.id, folder.name))
        for character in database.characters.find({"folder_id": request.folder_id}):
            if character.has_permission(request.requester.id, level=Permissions.READ):
                characters.append((character.id, character.name, character.image))
    subfolders.sort(key=lambda f: f[1])
    characters.sort(key=lambda c: c[1])
    return {
        "status": "success",
        "name": folder_name,
        "parent_id": parent_id,
        "subfolders": subfolders,
        "characters": characters
    }


@app.post("/api/map/create")
async def map_create(request: GMRequest):
    map = database.maps.create({"name": "New Map"})
    await get_pool("maps").broadcast({
        "type": "create",
        "id": map.id,
        "name": map.name,
    })
    return {"status": "success", "id": map.id}


class MapGetRequest(AuthRequest):
    id: str


@app.post("/api/map/get")
async def map_get(request: MapGetRequest):
    map = require(database.maps.find_one(request.id), "invalid map id")
    auth_require(request.requester.is_gm or map.has_permission(request.requester.id, "*", Permissions.READ))
    return {
        "status": "success",
        "map": map.model_dump()
    }


class MapDeleteRequest(AuthRequest):
    id: str


@app.post("/api/map/delete")
async def map_delete(request: MapDeleteRequest):
    map = require(database.maps.find_one(request.id), "invalid map id")
    if not request.requester.is_gm:
        auth_require(map.has_permission(request.requester.id, "*", Permissions.OWNER))
    database.maps.delete_one(map.id)
    await get_pool("maps").broadcast({
        "type": "delete",
        "id": map.id,
    })
    return {"status": "success"}


class MapUpdateRequest(AuthRequest):
    id: str
    changes: Dict


@app.post("/api/map/update")
async def map_update(request: MapUpdateRequest):
    map = require(database.maps.find_one(request.id), "invalid map id")
    if not request.requester.is_gm:
        auth_require(map.has_permission(request.requester.id, "*", Permissions.WRITE))

    database.maps.find_one_and_update(request.id, request.changes)

    await map.broadcast_changes(request.changes)
    return {"status": "success"}


@app.post("/api/map/list")
async def map_list(request: AuthRequest):
    maps = []
    if request.requester.is_gm:
        for map in database.maps.find():
            maps.append((map.id, map.name))
    else:
        for map in database.maps.find():
            if map.has_permission(request.requester.id, level=Permissions.READ):
                maps.append((map.id, map.name))
    return {"status": "success", "maps": maps}


class NewCombatRequest(GMRequest):
    name: str


@app.post("/api/combat/create")
async def combat_new(request: NewCombatRequest):
    combat: Combat = database.combats.create({"name": request.name})
    return {
        "status": "success",
        "combat": combat.model_dump()
    }


class GetCombatRequest(AuthRequest):
    id: str


@app.post("/api/combat/get")
async def combat_get(request: GetCombatRequest):
    combat = database.combats.find_one(request.id)

    if combat is None:
        raise JsonError("invalid combat id")

    return {
        "status": "success",
        "combat": combat.model_dump(),
    }


class CombatUpdateRequest(AuthRequest):
    id: str
    changes: Dict


@app.post("/api/combat/update")
async def combat_update(request: CombatUpdateRequest):
    combat = require(database.combats.find_one(request.id), "invalid combat id")
    if not request.requester.is_gm:
        auth_require(combat.has_permission(request.requester.id, "*", Permissions.WRITE))

    database.combats.find_one_and_update(request.id, request.changes)

    await combat.broadcast_changes(request.changes)
    return {"status": "success"}


class CombatSortRequest(AuthRequest):
    id: str


@app.post("/api/combat/sort")
async def combat_sort(request: CombatSortRequest):
    combat = require(database.combats.find_one(request.id), "invalid combat id")
    require(len(combat.combatants) > 0, "not enough combatants")
    if not request.requester.is_gm:
        auth_require(combat.has_permission(request.requester.id, "*", Permissions.WRITE))

    combatants = combat.combatants
    combatants.sort(key=lambda c: c.initiative if c.initiative else 0, reverse=True)

    update = {"$set": {
        "combatants": [c.model_dump() for c in combatants],
    }}

    database.combats.find_one_and_update(request.id, update)
    await combat.broadcast_changes(update)

    return {"status": "success"}


class CombatShuffleRequest(AuthRequest):
    id: str


@app.post("/api/combat/shuffle")
async def combat_sort(request: CombatShuffleRequest):
    combat = require(database.combats.find_one(request.id), "invalid combat id")
    require(len(combat.combatants) > 0, "not enough combatants")
    if not request.requester.is_gm:
        auth_require(combat.has_permission(request.requester.id, "*", Permissions.WRITE))

    combatants = list(combat.combatants)
    random.shuffle(combatants)

    update = {"$set": {
        "combatants": [c.model_dump() for c in combatants],
    }}

    database.combats.find_one_and_update(request.id, update)
    await combat.broadcast_changes(update)

    return {"status": "success"}


class CombatClearRequest(AuthRequest):
    id: str


@app.post("/api/combat/clear")
async def combat_clear(request: CombatClearRequest):
    combat = require(database.combats.find_one(request.id), "invalid combat id")
    require(len(combat.combatants) > 0, "not enough combatants")
    if not request.requester.is_gm:
        auth_require(combat.has_permission(request.requester.id, "*", Permissions.WRITE))

    update = {"$set": {
        "combatants": [],
    }}

    database.combats.find_one_and_update(request.id, update)
    await combat.broadcast_changes(update)

    return {"status": "success"}


class AnnounceTurnRequest(AuthRequest):
    id: str


@app.post("/api/combat/announce-turn")
async def combat_announce_turn(request: AnnounceTurnRequest):
    combat = require(database.combats.find_one(request.id), "invalid combat id")
    auth_require(request.requester.is_gm)
    require(len(combat.combatants) > 0, "not enough combatants")
    combatant = combat.combatants[0]
    await send_message(
        f'<div class="turn-start">Turn Start: {combatant.name}</div>',
        user=request.requester,
    )
    return {"status": "success"}


class ReverseTurnRequest(AuthRequest):
    id: str


@app.post("/api/combat/reverse-turn")
async def combat_end_turn(request: ReverseTurnRequest):
    combat = require(database.combats.find_one(request.id), "invalid combat id")
    auth_require(request.requester.is_gm)
    require(len(combat.combatants) > 1, "not enough combatants")
    combatant = combat.combatants[-1]

    database.combats.find_one_and_update(request.id, {
        "$pull": {
            "combatants": {
                "id": combatant.id,
            },
        },
    })
    database.combats.find_one_and_update(request.id, {
        "$push": {
            "combatants": {
                "$each": [combatant.model_dump()],
                "$position": 0,
            }
        }
    })

    await combat.pool.broadcast({"type": "reverse-turn", "id": combatant.id})
    await send_message(
        f'<div class="turn-start">Turn Start: {combatant.name}</div>',
        user=request.requester,
    )
    return {"status": "success"}


class EndTurnRequest(AuthRequest):
    id: str


@app.post("/api/combat/end-turn")
async def combat_end_turn(request: EndTurnRequest):
    combat = require(database.combats.find_one(request.id), "invalid combat id")
    require(len(combat.combatants) > 1, "not enough combatants")
    combatant = combat.combatants[0]
    if not request.requester.is_gm:
        if combatant.character_id is not None:
            character = require(database.characters.find_one(combatant.character_id), "invalid character id")
            auth_require(
                combat.has_permission(request.requester.id, "*", Permissions.WRITE)
                or
                character.has_permission(request.requester.id, "*", Permissions.OWNER)
            )
        else:
            auth_require(combat.has_permission(request.requester.id, "*", Permissions.WRITE))

    database.combats.find_one_and_update(request.id, {
        "$pull": {
            "combatants": {
                "id": combatant.id,
            },
        },
    })
    database.combats.find_one_and_update(request.id, {
        "$push": {
            "combatants": combatant.model_dump()
        }
    })

    await combat.pool.broadcast({"type": "end-turn", "id": combatant.id})
    await send_message(
        f'<div class="turn-start">Turn Start: {combat.combatants[1].name}</div>',
        user=request.requester,
    )
    return {"status": "success"}


@app.post("/api/combat/list")
async def combat_list(request: AuthRequest):
    return {
        "status": "success",
        "combats": [
            combat.model_dump()
            for combat in database.combats.find()
        ],
    }


class AddCombatantRequest(AuthRequest):
    combat_id: Optional[str] = None
    character_id: Optional[str] = None
    name: Optional[str] = None



@app.post("/api/combat/add-combatant")
async def add_combatant(request: AddCombatantRequest):
    if request.combat_id is None:
        combat = require(database.combats.find_one({}), "no combat")
    else:
        combat = require(database.combats.find_one(request.combat_id), "invalid combat id")

    auth_require(
        request.requester.is_gm
        or
        combat.has_permission(request.requester.id, "*", Permissions.WRITE)
    )

    require(request.character_id is not None or request.name is not None, "name or character_id is required")
    combatant_id = secrets.token_hex(12)
    combatant = {"id": combatant_id}

    if request.character_id is not None:
        character = require(database.characters.find_one(request.character_id), "invalid character id")
        combatant["name"] = character.name
        combatant["permissions"] = character.permissions
        combatant["character_id"] = character.id

    if request.name is not None:
        combatant["name"] = request.name

    update = {
        "$push": {
            "combatants": combatant
        }
    }
    database.combats.find_one_and_update(combat.id, update)
    await combat.broadcast_changes(update)
    return {"status": "success", "id": combatant_id}


class RollRequest(AuthRequest):
    formula: str
    character_id: Optional[str]
    silent: bool = True


@app.post("/api/messages/roll")
async def send_roll(request: RollRequest):
    response = {"status": "success"}

    character: Optional[Character] = None
    if request.character_id is not None:
        character = require(database.characters.find_one(request.character_id), "character does not exist")

    # Permissions checks
    if not request.requester.is_gm and character is not None:
        auth_require(character.has_permission(request.requester.id, field="speak", level=Permissions.WRITE))

    try:
        result = expressions.evaluate(request.formula, character.data if character else None)
    except Exception as e:
        raise JsonError(str(e))

    if not request.silent:
        message = await send_message(
            f"<p>{request.formula} = {result}</p>",
            user=request.requester,
            character_id=request.character_id,
            speaker=request.requester.name,
        )
        response["id"] = message.id

    response["result"] = result
    return response


class SaveMessagesRequest(GMRequest):
    filename: str


@app.post("/api/messages/save")
async def messages_save(request: SaveMessagesRequest):
    path = validate_path(request.requester, (Path("/chats/") / request.filename).with_suffix(".json"))
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as fp:
        json.dump(
            {
                "timestamp": current_timestamp(),
                "messages": [message.model_dump() for message in database.messages.find()],
            },
            fp
        )

    return {"status": "success"}


@app.post("/api/messages/clear")
async def messages_clear(request: GMRequest):
    database.messages.delete_many()
    await get_pool("messages").broadcast({"type": "clear"})
    return {"status": "success"}


class SendMessageRequest(AuthRequest):
    speaker: str
    content: str
    character_id: Optional[str] = None
    language: Language = Language.COMMON


@app.post("/api/messages/speak")
async def messages_speak(request: SendMessageRequest):
    # Permissions checks
    if not request.requester.is_gm:
        if request.character_id is not None:
            character = require(database.characters.find_one(request.character_id), "character does not exist")
            auth_require(character.has_permission(request.requester.id, field="speak", level=Permissions.WRITE))
            auth_require(request.speaker == character.name)
        else:
            auth_require(request.speaker == request.requester.name)
        auth_require(request.language == Language.COMMON or request.language in request.requester.languages)
    # Create message
    message = await send_message(
        request.content,
        user=request.requester,
        character_id=request.character_id,
        speaker=request.speaker,
        language=request.language,
    )
    return {"status": "success", "id": message.id}


@app.post("/api/messages/recent")
async def recent_messages(request: AuthRequest):
    languages = request.requester.languages
    return {
        "status": "success",
        "messages": [
            (
                message.model_dump()
                if message.language == Language.COMMON or message.language in languages else
                message.foreign_dict()
            )
            for message in database.messages.find()
        ]
    }


class EditMessageRequest(GMRequest):
    id: str
    content: str


@app.post("/api/messages/edit")
async def edit_message(request: EditMessageRequest):
    database.messages.find_one_and_update(request.id, {"$set": {"content": request.content}})
    await get_pool("messages").broadcast({"type": "edit", "id": request.id, "content": request.content})
    return {"status": "success"}


class DeleteMessageRequest(GMRequest):
    id: str


@app.post("/api/messages/delete")
async def delete_message(request: DeleteMessageRequest):
    database.messages.delete_one(request.id)
    await get_pool("messages").broadcast({"type": "delete", "id": request.id})
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
        while True:
            await handle_ws_request(connection, await websocket.receive_json())
    except starlette.websockets.WebSocketDisconnect:
        pass
    finally:
        for pool in connection.pools:
            pool.discard(connection)


@app.post("/api/status")
async def status(request: AuthRequest):
    return {
        "status": "success",
        "user": request.requester.model_dump(),
    }


def validate_path(requester: User, path: str) -> Path:
    # Make sure path is absolute
    path: Path = Path(path)
    if not path.is_absolute():
        raise JsonError("not an absolute path")
    # Resolve '..' and symlinks in path
    path = path.resolve(strict=False)
    # Make path relative to user root
    user_root = requester.file_root
    path = user_root / Path(str(path)[1:])
    if path == user_root:
        raise JsonError("invalid path: file root")
    return path


def validate_directory(requester: User, path: str) -> Path:
    # Make sure path is absolute
    path: Path = Path(path)
    if not path.is_absolute():
        raise JsonError("not an absolute path")
    # Resolve '..' and symlinks in path
    path = path.resolve(strict=False)
    # Make path relative to user root
    user_root = requester.file_root
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
    try:
        new_path.mkdir()
    except FileExistsError:
        raise JsonError("directory already exists")
    await get_pool("files").broadcast({
        "type": "mkdir",
        "user": request.requester.id,
        "path": str(Path(request.path) / request.name),
    })
    return {"status": "success"}


def recursive_delete(path: Path):
    if path.is_dir():
        for sub_path in list(path.iterdir()):
            recursive_delete(sub_path)
        path.rmdir()
    else:
        path.unlink()
        files.delete_thumbnail(path)


class DeleteFileRequest(AuthRequest):
    path: str


@app.post("/api/files/delete")
async def delete_file(request: DeleteFileRequest):
    path = validate_path(request.requester, request.path)
    # Check that path is a file or directory that exists
    if not path.exists():
        raise JsonError("path does not exist")
    recursive_delete(path)
    await get_pool("files").broadcast({
        "type": "delete",
        "user": request.requester.id,
        "path": request.path,
    })
    return {"status": "success"}


@app.post("/api/files/upload")
async def upload_file(token: str = Form(...), path: str = Form(...), file: UploadFile = File(...)):
    session: Session = database.sessions.find_one({"auth_token": token})
    if session is None:
        raise AuthError("invalid token")

    requester: User = database.users.find_one(session.user_id)
    if requester is None:
        raise AuthError("valid token for deleted user")

    resolved_path = validate_directory(requester, path)

    # Copy file to permanent location
    with open(resolved_path / file.filename, "wb") as f:
        shutil.copyfileobj(file.file, f)

    await get_pool("files").broadcast({
        "type": "upload",
        "user": requester.id,
        "path": str(Path(path) / file.filename),
    })
    return {"status": "success"}


class MoveFileRequest(AuthRequest):
    src: str
    dst: str


@app.post("/api/files/move")
async def move_file(request: MoveFileRequest):
    # Validate paths
    src = validate_path(request.requester, request.src)
    dst = validate_path(request.requester, request.dst)
    src.rename(dst)
    await get_pool("files").broadcast({
        "type": "rename",
        "user": request.requester.id,
        "src": str(src),
        "dst": str(dst),
    })
    return {"status": "success"}


class ListFilesRequest(AuthRequest):
    path: str


@app.post("/api/files/list")
async def list_files(request: ListFilesRequest):
    # Validate path
    path = validate_directory(request.requester, request.path)
    # Make path relative to user root
    user_root = request.requester.file_root
    # Get list of files
    if path == user_root:
        returned_path = "/"
    else:
        returned_path = "/" + str(path.relative_to(user_root))

    results = [
        (
            files.sniff(subpath),
            "/" + str(subpath.relative_to(user_root))
        )
        for subpath in path.iterdir()
    ]
    results.sort()

    for file_type, file_path in results:
        if file_type == "image/svg":
            files.generate_thumbnail(user_root / file_path.lstrip("/"), svg=True)
        elif file_type.startswith("image/"):
            files.generate_thumbnail(user_root / file_path.lstrip("/"))

    return {
        "status": "success",
        "path": returned_path,
        "files": results
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
