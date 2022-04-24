import secrets
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from db import db
from db_models import DBUser
from security import check_password


class AuthError(Exception):
    pass


app = FastAPI()


@app.exception_handler(AuthError)
async def auth_error_handler(request: Request, exc: AuthError):
    return JSONResponse(status_code=401, content={
        "status": "error",
        "reason": str(exc)
    })


class AuthRequest(BaseModel):
    token: str


def get_request_user(request) -> DBUser:
    entry = db.users.index_get("token", request.token)
    if entry is None:
        raise AuthError("invalid or missing token")
    return DBUser.parse_obj(entry.data)


@app.post("/api/status")
async def status(request: AuthRequest):
    user = get_request_user(request)
    return {"status": "success", "username": user.name}


class LoginRequest(BaseModel):
    username: str
    password: str


@app.post("/api/login")
async def login(request: LoginRequest):
    # Find the requested user by username
    user_entry = db.users.index_get("username", request.username)
    if user_entry is None:
        raise AuthError("invalid username or password")

    # Convert the db entry to a User model
    user = DBUser.parse_obj(user_entry.data)

    # Check the password
    if not check_password(request.password, user.hashed_password):
        raise AuthError("invalid username or password")

    # Generate a token and create a session
    token = secrets.token_hex(16)
    db.users.index_set("token", token, user.id)
    return {"status": "success", "token": token}


@app.on_event("shutdown")
async def shutdown():
    print("Saving database ...")
    db.save()
