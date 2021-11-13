import inspect
import utilities
import secrets
from typing import Any, Optional, Union

import strawberry
from db import db
from db_models import DBUser
from fastapi import Request, WebSocket
from security import check_password, hash_password
from strawberry.permission import BasePermission
from strawberry.types import Info
from strawberry.types.info import ContextType


def get_user_from_context(context: ContextType) -> Optional[DBUser]:
    request: Union[Request, WebSocket] = context["request"]

    # This user has already been authenticated previously
    if user := context.get("user"):
        return user

    # An auth token has been passed
    elif "Authorization" in request.headers:
        token: str = request.headers["Authorization"]
        if token.startswith("Bearer "):
            token = token[7:]
        entry = db.users.index_get("token", token)
        if entry is None:
            return None
        user = DBUser.parse_obj(entry.data)
        context["user"] = user
        return user

    # No user was found
    else:
        return None


class Requireable(BasePermission):
    def require(self, source: Any = None, info: Info = None, **kwargs):
        if not self.has_permission(source, info, **kwargs):
            raise Exception(self.message)

    async def has_permission(self, source: Any, info: Info, **kwargs) -> bool:
        resolver = getattr(self, "resolve")
        if inspect.iscoroutinefunction(resolver):
            return await resolver(info)
        else:
            return resolver(info)


class IsGM(Requireable):
    message = "User is not a GM"

    def resolve(self, info: Info) -> bool:
        user = get_user_from_context(info.context)
        return user is not None and user.is_gm


class IsAuthenticated(Requireable):
    message = "User is not authenticated"

    def resolve(self, info: Info) -> bool:
        return get_user_from_context(info.context) is not None


@strawberry.type
class User:
    id: str
    name: str
    is_gm: bool


@strawberry.type
class Query:
    @strawberry.field(permission_classes=[IsAuthenticated])
    def user(self, info: Info, id: Optional[str] = None) -> User:
        if id is None:
            user = get_user_from_context(info.context)
        else:
            entry = db.users[id]
            if entry is None:
                raise KeyError(f"User with id '{id}' does not exist")
            user = DBUser.parse_obj(entry.data)
        return User(user.id, user.name, user.is_gm)


@strawberry.type
class Mutation:
    @strawberry.mutation
    def login(self, info: Info, username: str, password: str) -> str:
        # Find the requested user by username
        user_entry = db.users.index_get("username", username)
        if user_entry is None:
            raise Exception("invalid username or password")

        # Convert the db entry to a User model
        user = DBUser.parse_obj(user_entry.data)

        # Check the password
        if not check_password(password, user.hashed_password):
            raise Exception("invalid username or password")

        # Generate a token and create a session
        token = secrets.token_hex(16)
        db.users.index_set("token", token, user.id)
        return token

    @strawberry.mutation(permission_classes=[IsGM])
    def register_user(self, info: Info, username: str, password: str) -> User:
        id = utilities.random_id()
        db.users.add(
            {
                "id": id,
                "name": username,
                "hashed_password": hash_password(password),
                "is_gm": False,
            }
        )
        db.users.index_set("username", username, id)
        return User(id, username, False)

    @strawberry.mutation(permission_classes=[IsGM])
    def delete_user(self, info: Info, id: str) -> bool:
        if id not in db.users:
            raise Exception("user does not exist")
        user = get_user_from_context(info.context)
        if id == user.id:
            raise Exception("you can't delete your own account")
        db.users.delete(id)
        return True


schema = strawberry.Schema(Query, Mutation)
