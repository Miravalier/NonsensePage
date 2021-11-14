from __future__ import annotations

from typing import Any, Optional, Type, TypeVar, Union

from db import DBEntry, db
from db_models import DBUser
from fastapi import Request, WebSocket
from strawberry.permission import BasePermission
from strawberry.types import Info
from strawberry.types.info import ContextType

T = TypeVar("T")


def db_to_graphql(entry: Optional[DBEntry], schema: Type[T], info: Info) -> T:
    if entry is None:
        return schema()
    else:
        return entry.as_schema(schema, info)


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


class Hidden(BasePermission):
    def has_permission(self, source: Any, info: Info, **kwargs) -> bool:
        return False


class Requireable(BasePermission):
    def require(self, source: Any = None, info: Info = None, **kwargs):
        if not self.has_permission(source, info, **kwargs):
            raise Exception(self.message)

    def has_permission(self, source: Any, info: Info, **kwargs) -> bool:
        return self.resolve(info)

    def resolve(info: Info) -> bool:
        return False


class IsGM(Requireable):
    message = "User is not a GM"

    def resolve(self, info: Info) -> bool:
        user = get_user_from_context(info.context)
        return user is not None and user.is_gm


class IsAuthenticated(Requireable):
    message = "User is not authenticated"

    def resolve(self, info: Info) -> bool:
        return get_user_from_context(info.context) is not None
