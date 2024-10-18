from fastapi import APIRouter

from ..lib import database
from ..lib.errors import JsonError
from ..lib.utils import require
from ..lib.security import hash_password
from ..models.database_models import User, get_pool
from ..models.request_models import AuthRequest, GMRequest


router = APIRouter()


class UserCreateRequest(GMRequest):
    username: str
    password: str


@router.post("/create")
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


class UserUpdateRequest(GMRequest):
    id: str
    changes: dict


@router.post("/update")
async def user_update(request: UserUpdateRequest):
    user = require(database.users.find_one_and_update(request.id, request.changes), "invalid user id")

    await user.broadcast_changes(request.changes)
    await get_pool("users").broadcast({
        "type": "update",
        "user": user.model_dump(),
    })

    return {"status": "success"}


class SettingsUpdateRequest(AuthRequest):
    changes: dict[str, str|bool|int|float]


@router.post("/settings")
async def settings_update(request: SettingsUpdateRequest):
    user = request.requester

    changes = {}
    for path, value in request.changes.items():
        changes[f"settings.{path}"] = value

    update_document = {"$set": changes}
    user = database.users.find_one_and_update(user.id, update_document)

    await user.broadcast_changes(update_document)
    await get_pool("users").broadcast({
        "type": "update",
        "user": user.model_dump(),
    })

    return {"status": "success"}


class UserDeleteRequest(GMRequest):
    id: str


@router.post("/delete")
async def user_delete(request: UserDeleteRequest):
    if not database.users.delete_one(request.id):
        raise JsonError("No user exists with that id")

    await get_pool("users").broadcast({
        "type": "delete",
        "id": request.id,
    })

    return {"status": "success"}


@router.post("/list")
async def user_list(request: AuthRequest):
    return {"status": "success", "users": [user.model_dump() for user in database.users.find()]}
