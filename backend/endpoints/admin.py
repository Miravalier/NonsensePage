from fastapi import APIRouter

from ..lib import database
from ..lib.errors import JsonError
from ..lib.security import hash_password
from ..models.database_models import User
from ..models.request_models import AdminConsoleRequest


router = APIRouter()


class CreateAdminRequest(AdminConsoleRequest):
    username: str
    password: str


@router.post("/create")
async def admin_create_request(request: CreateAdminRequest):
    if database.users.find_one({"name": request.username}):
        raise JsonError("username taken")
    user: User = database.users.create({"name": request.username, "hashed_password": hash_password(request.password), "is_gm": True})
    return {"status": "success", "id": user.id}


@router.post("/list-users")
async def admin_create_request(request: AdminConsoleRequest):
    return {"status": "success", "users": [user.name for user in database.users.find()]}
