from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter
from typing import Optional

from ..lib import database
from ..lib.errors import JsonError
from ..lib.folders import delete_folder
from ..lib.utils import require, auth_require
from ..models.database_models import Permissions, get_pool
from ..models.request_models import AuthRequest, GMRequest


router = APIRouter()


class AbilityCreateRequest(AuthRequest):
    name: str
    folder_id: Optional[str] = None


@router.post("/create")
async def ability_create(request: AbilityCreateRequest):
    options = {"name": request.name}
    if not request.requester.is_gm:
        options["permissions"] = {"*": {"*": Permissions.READ}, request.requester.id: {"*": Permissions.OWNER}}
    if request.folder_id is not None:
        folder = require(database.ability_folders.find_one(request.folder_id), "invalid folder id")
        if not request.requester.is_gm:
            auth_require(folder.has_permission(request.requester.id, "*", Permissions.WRITE))
        options["folder_id"] = request.folder_id

    ability = database.abilities.create(options)

    await get_pool("abilities").broadcast({
        "type": "create",
        "folder": ability.folder_id,
        "id": ability.id,
        "name": ability.name,
    })
    return {"status": "success", "id": ability.id}


class AbilityDeleteRequest(AuthRequest):
    id: str


@router.post("/delete")
async def ability_delete(request: AbilityDeleteRequest):
    ability = require(database.abilities.find_one(request.id), "invalid ability id")
    if not request.requester.is_gm:
        auth_require(ability.has_permission(request.requester.id, "*", Permissions.OWNER))
    database.abilities.delete_one(ability.id)
    await ability.pool.broadcast({
        "type": "delete",
    })
    await get_pool("abilities").broadcast({
        "type": "delete",
        "folder": ability.folder_id,
        "id": ability.id,
    })
    return {"status": "success"}


class AbilityUpdateRequest(AuthRequest):
    id: str
    changes: dict


@router.post("/update")
async def ability_update(request: AbilityUpdateRequest):
    ability = require(database.abilities.find_one(request.id), "invalid ability id")
    if not request.requester.is_gm:
        auth_require(ability.has_permission(request.requester.id, "*", Permissions.WRITE))

    database.abilities.find_one_and_update(request.id, request.changes)

    await ability.broadcast_changes(request.changes)

    if name := request.changes.get("$set", {}).get("name", None):
        await get_pool("abilities").broadcast({
            "type": "rename",
            "folder": ability.folder_id,
            "id": request.id,
            "name": name,
        })

    return {"status": "success"}


class AbilityGetRequest(AuthRequest):
    id: str = None
    name: str = None


@router.post("/get")
async def ability_get(request: AbilityGetRequest):
    if request.id is None and request.name is None:
        raise JsonError("get ability by either id or name, passed neither")
    if request.id is not None and request.name is not None:
        raise JsonError("get ability by either id or name, passed both")

    if request.id:
        ability = require(database.abilities.find_one(request.id), "invalid ability id")
    else:
        ability = require(database.abilities.find_one({"name": request.name}), "invalid ability name")

    require(request.requester.is_gm or ability.has_permission(request.requester.id, "*", Permissions.READ))
    return {"status": "success", "ability": ability.model_dump()}


class AbilityListRequest(AuthRequest):
    folder_id: Optional[str] = None
    retrieve_all: bool = False


@router.post("/list")
async def ability_list(request: AbilityListRequest):
    if request.folder_id is not None:
        try:
            folder = require(database.ability_folders.find_one({"$or": [
                {"_id": ObjectId(request.folder_id)},
                {"alternate_id": request.folder_id},
            ]}), "invalid folder id")
        except InvalidId:
            folder = require(database.ability_folders.find_one({
                "alternate_id": request.folder_id
            }), "invalid folder id")

        folder_id = folder.id
        folder_name = folder.name
        parent_id = folder.parent_id
    else:
        folder_id = None
        folder_name = "/"
        parent_id = None

    subfolders = []
    for folder in database.ability_folders.find({"parent_id": folder_id}):
        if request.requester.is_gm or folder.has_permission(request.requester.id, level=Permissions.READ):
            subfolders.append((folder.id, folder.name))
    subfolders.sort(key=lambda f: f[1])

    abilities = []
    for ability in database.abilities.find({"folder_id": folder_id}):
        if request.requester.is_gm or ability.has_permission(request.requester.id, level=Permissions.READ):
            if request.retrieve_all:
                abilities.append(ability.model_dump())
            else:
                abilities.append((ability.id, ability.name, ability.image))
    if request.retrieve_all:
        abilities.sort(key=lambda entry: entry["name"])
    else:
        abilities.sort(key=lambda c: c[1])

    return {
        "status": "success",
        "name": folder_name,
        "parent_id": parent_id,
        "subfolders": subfolders,
        "entries": abilities
    }


class AbilityMoveRequest(AuthRequest):
    ability_id: Optional[str] = None
    folder_id: Optional[str] = None
    dst_id: Optional[str] = None


@router.post("/move")
async def ability_move(request: AbilityMoveRequest):
    if request.dst_id is not None:
        dst_folder = require(database.ability_folders.find_one(request.dst_id), "invalid folder id")
        if not request.requester.is_gm:
            auth_require(dst_folder.has_permission(request.requester.id, "*", Permissions.WRITE))

    require(request.ability_id or request.folder_id, "no src specified")
    require(not (request.ability_id and request.folder_id), "both folder and ability ids specified")

    if request.ability_id is not None:
        ability = require(database.abilities.find_one(request.ability_id), "invalid ability id")
        require(ability.folder_id != request.dst_id, "src and dst folder must differ")
        if not request.requester.is_gm:
            auth_require(ability.has_permission(request.requester.id, "*", Permissions.OWNER))
        database.abilities.find_one_and_update(request.ability_id, {"$set": {"folder_id": request.dst_id}})
        await ability.pool.broadcast({
            "type": "move",
            "src": ability.folder_id,
            "dst": request.dst_id,
        })
        await get_pool("abilities").broadcast({
            "type": "move",
            "src": ability.folder_id,
            "dst": request.dst_id,
            "id": ability.id,
            "name": ability.name,
            "image": ability.image,
        })

    if request.folder_id is not None:
        require(request.folder_id != request.dst_id, "folder cannot contain itself")
        folder = require(database.ability_folders.find_one(request.folder_id), "invalid folder id")
        require(folder.parent_id != request.dst_id, "src and dst folder must differ")
        if not request.requester.is_gm:
            auth_require(folder.has_permission(request.requester.id, "*", Permissions.OWNER))
        database.ability_folders.find_one_and_update(request.folder_id, {"$set": {"parent_id": request.dst_id}})
        await get_pool("abilities").broadcast({
            "type": "movedir",
            "src": folder.parent_id,
            "dst": request.dst_id,
            "id": folder.id,
            "name": folder.name,
        })
    return {"status": "success"}


class AbilityFolderRenameRequest(AuthRequest):
    id: str
    name: str


@router.post("/folder/rename")
async def ability_folder_rename(request: AbilityFolderRenameRequest):
    folder = require(database.ability_folders.find_one(request.id), "invalid folder id")
    if not request.requester.is_gm:
        auth_require(folder.has_permission(request.requester.id, "*", Permissions.OWNER))
    database.ability_folders.find_one_and_update(request.id, {"$set": {"name": request.name}})
    await get_pool("abilities").broadcast({
        "type": "renamedir",
        "folder": request.id,
        "name": request.name,
    })
    return {"status": "success"}


class AbilityFolderCreateRequest(AuthRequest):
    name: str
    parent: Optional[str] = None


@router.post("/folder/create")
async def ability_folder_create(request: AbilityFolderCreateRequest):
    if request.parent is not None:
        require(database.ability_folders.find_one(request.parent), "invalid folder id")
    options = {"name": request.name, "parent_id": request.parent}
    if not request.requester.is_gm:
        options["permissions"] = {"*": {"*": Permissions.READ}, request.requester.id: {"*": Permissions.OWNER}}
    folder = database.ability_folders.create(options)
    await get_pool("abilities").broadcast({
        "type": "mkdir",
        "folder": request.parent,
        "id": folder.id,
        "name": folder.name,
    })
    return {"status": "success", "id": folder.id}


class AbilityFolderDeleteRequest(AuthRequest):
    folder_id: str


@router.post("/folder/delete")
async def ability_folder_delete(request: AbilityFolderDeleteRequest):
    folder = require(database.ability_folders.find_one(request.folder_id), "invalid folder id")
    if not request.requester.is_gm:
        auth_require(folder.has_permission(request.requester.id, "*", Permissions.OWNER))
    delete_folder("ability", folder)
    await get_pool("abilities").broadcast({
        "type": "rmdir",
        "folder": folder.id,
    })
    return {"status": "success"}


class AbilityFolderSetAltIdRequest(GMRequest):
    folder_id: str
    alternate_id: str


@router.post("/folder/alt-id")
async def ability_folder_alt_id(request: AbilityFolderSetAltIdRequest):
    require(database.ability_folders.find_one_and_update(
        request.folder_id,
        {"$set": {"alternate_id": request.alternate_id}}
    ), "invalid folder_id")
    return {"status": "success"}
