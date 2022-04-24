import secrets
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from database import db, User
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


def get_request_user(request) -> User:
    user = db.users_by_token.get(request.token, None)
    if user is None:
        raise AuthError("invalid or missing token")
    return user


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
    user = db.users_by_name.get(request.username, None)
    if user is None:
        raise AuthError("invalid username or password")

    # Check the password
    if not check_password(request.password, user.hashed_password):
        raise AuthError("invalid username or password")

    # Generate a token and create a session
    token = secrets.token_hex(16)
    user.add_collection("users_by_token", token)
    return {"status": "success", "token": token}


@app.on_event("shutdown")
async def shutdown():
    print("Saving database ...")
    db.save()
