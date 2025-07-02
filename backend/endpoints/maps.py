import shapely
from fastapi import APIRouter

from ..lib import database
from ..lib.utils import require, auth_require
from ..models.database_models import Permissions, Polygon, get_pool
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


class DeleteTokenRequest(AuthRequest):
    map: str
    token_id: str


@router.post("/delete-token")
async def map_delete_token(request: DeleteTokenRequest):
    map = require(database.maps.find_one(request.map), "invalid map id")
    if not request.requester.is_gm:
        auth_require(map.has_permission(request.requester.id, "*", Permissions.WRITE))

    token = require(map.tokens.get(request.token_id), "invalid token id")

    character = database.characters.find_one(token.character_id)
    if character is not None and character.temporary:
        database.characters.delete_one(character.id)

    changes = {
        "$unset": {
            f"tokens.{token.id}": None,
        },
    }
    database.maps.find_one_and_update(request.map, changes)
    await map.broadcast_changes(changes)

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


class MapPolygonRequest(AuthRequest):
    id: str
    area: Polygon


@router.post("/reveal")
async def map_reveal(request: MapPolygonRequest):
    map = require(database.maps.find_one(request.id), "invalid map id")
    if not request.requester.is_gm:
        auth_require(map.has_permission(request.requester.id, "reveal", Permissions.WRITE))

    if map.revealed_areas is None:
        map.revealed_areas = request.area
    else:
        map.revealed_areas = map.revealed_areas.union(request.area)

    changes = {"$set": {"revealed_areas": shapely.geometry.mapping(map.revealed_areas)}}
    database.maps.find_one_and_update(request.id, changes)
    await map.broadcast_changes(changes)


@router.post("/hide")
async def map_hide(request: MapPolygonRequest):
    map = require(database.maps.find_one(request.id), "invalid map id")
    if not request.requester.is_gm:
        auth_require(map.has_permission(request.requester.id, "reveal", Permissions.WRITE))

    if map.revealed_areas is None:
        return

    map.revealed_areas = map.revealed_areas.difference(request.area)

    changes = {"$set": {"revealed_areas": shapely.geometry.mapping(map.revealed_areas)}}
    database.maps.find_one_and_update(request.id, changes)
    await map.broadcast_changes(changes)
