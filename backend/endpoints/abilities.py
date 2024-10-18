from fastapi import APIRouter
from typing import Optional

from ..lib import database
from ..lib.errors import JsonError
from ..lib.utils import require, auth_require
from ..models.database_models import Ability, Permissions, get_pool
from ..models.request_models import AuthRequest


router = APIRouter()


class AbilityCreateRequest(AuthRequest):
    document: Ability


@router.post("/create")
async def ability_create(request: AbilityCreateRequest):
    ability = request.document

    if ability.name is None:
        ability.name = "New Ability"

    if not request.requester.is_gm:
        ability.add_permission("*", "*", Permissions.READ)
        ability.add_permission(request.requester.id, "*", Permissions.OWNER)

    if ability.folder_id is not None:
        folder = require(database.ability_folders.find_one(ability.folder_id), "invalid folder id")
        if not request.requester.is_gm:
            auth_require(folder.has_permission(request.requester.id, "*", Permissions.WRITE))

    ability = database.abilities.create(ability.model_dump(exclude_defaults=True))

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
