import hashlib
import os
from pydantic import BaseModel, Field, validator
from hmac import compare_digest

from .database_models import User, Session
from ..lib import database
from ..lib.utils import auth_require
from ..lib.errors import JsonError


ADMIN_HASH = hashlib.sha256(os.environ.get("ADMIN_TOKEN", "").encode()).digest()


class AdminConsoleRequest(BaseModel):
    admin_token: str

    @validator('admin_token')
    def resolve_admin_token(cls, value: str):
        request_hash = hashlib.sha256(value.encode()).digest()
        if not compare_digest(ADMIN_HASH, request_hash):
            raise JsonError("invalid admin key")
        return value


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
