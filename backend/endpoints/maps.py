from fastapi import APIRouter

from ..lib import database
from ..lib.utils import require, auth_require
from ..models.database_models import Permissions, get_pool
from ..models.request_models import AuthRequest, GMRequest


router = APIRouter()


@router.post("/create")
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


@router.post("/get")
async def map_get(request: MapGetRequest):
    map = require(database.maps.find_one(request.id), "invalid map id")
    auth_require(request.requester.is_gm or map.has_permission(request.requester.id, "*", Permissions.READ))
    return {
        "status": "success",
        "map": map.model_dump()
    }


class MapDeleteRequest(AuthRequest):
    id: str


@router.post("/delete")
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
    changes: dict


@router.post("/update")
async def map_update(request: MapUpdateRequest):
    map = require(database.maps.find_one(request.id), "invalid map id")
    if not request.requester.is_gm:
        auth_require(map.has_permission(request.requester.id, "*", Permissions.WRITE))

    database.maps.find_one_and_update(request.id, request.changes)

    await map.broadcast_changes(request.changes)
    return {"status": "success"}


class MapPingRequest(AuthRequest):
    id: str
    x: float
    y: float


@router.post("/ping")
async def map_ping(request: MapPingRequest):
    map = require(database.maps.find_one(request.id), "invalid map id")
    if not request.requester.is_gm:
        auth_require(map.has_permission(request.requester.id, "ping", Permissions.WRITE))
    await map.pool.broadcast({"type": "ping", "x": request.x, "y": request.y})
    return {"status": "success"}


@router.post("/list")
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
