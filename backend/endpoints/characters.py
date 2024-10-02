from fastapi import APIRouter
from typing import Optional

from ..lib import database
from ..lib.errors import JsonError
from ..lib.folders import delete_folder
from ..lib.utils import require, auth_require
from ..models.database_models import Alignment, Permissions, get_pool
from ..models.request_models import AuthRequest


router = APIRouter()


class CharacterCreateRequest(AuthRequest):
    name: str
    alignment: Optional[Alignment] = None
    folder_id: Optional[str] = None


@router.post("/create")
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


@router.post("/delete")
async def character_delete(request: CharacterDeleteRequest):
    character = require(database.characters.find_one(request.id), "invalid character id")
    if not request.requester.is_gm:
        auth_require(character.has_permission(request.requester.id, "*", Permissions.OWNER))
    database.characters.delete_one(character.id)
    database.users.update_many({"character_id": character.id}, {"$set": {"character_id": None}})
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
    changes: dict


@router.post("/update")
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


@router.post("/get")
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


class CharacterListRequest(AuthRequest):
    folder_id: Optional[str] = None


@router.post("/list")
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
        "entries": characters
    }


class CharacterMoveRequest(AuthRequest):
    character_id: Optional[str] = None
    folder_id: Optional[str] = None
    dst_id: Optional[str] = None


@router.post("/move")
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


class CharacterFolderRenameRequest(AuthRequest):
    id: str
    name: str


@router.post("/folder/rename")
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


@router.post("/folder/create")
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


@router.post("/folder/delete")
async def character_folder_delete(request: CharacterFolderDeleteRequest):
    folder = require(database.character_folders.find_one(request.folder_id), "invalid folder id")
    if not request.requester.is_gm:
        auth_require(folder.has_permission(request.requester.id, "*", Permissions.OWNER))
    delete_folder("character", folder)
    await get_pool("characters").broadcast({
        "type": "rmdir",
        "folder": folder.id,
    })
    return {"status": "success"}
