import secrets
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pathlib import Path
from pydantic import BaseModel

import files
from messages import messages
from database import db, User
from security import check_password


FILES_ROOT = Path("/files")


class AuthError(Exception):
    pass


app = FastAPI()


@app.exception_handler(AuthError)
async def auth_error_handler(request: Request, exc: AuthError):
    return JSONResponse(status_code=401, content={
        "status": "error",
        "reason": str(exc)
    })


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
    return {"status": "success", "token": token, "gm": user.is_gm}


class AuthRequest(BaseModel):
    token: str


def get_request_user(request) -> User:
    user = db.users_by_token.get(request.token, None)
    if user is None:
        raise AuthError("invalid or missing token")
    return user


class SendMessageRequest(AuthRequest):
    speaker: str
    content: str


@app.post("/api/messages/send")
async def send_message(request: SendMessageRequest):
    user = get_request_user(request)
    message = messages.create(speaker=request.speaker, content=request.content)
    return {"status": "success", "id": message.id}


@app.post("/api/messages/recent")
async def recent_messages(request: AuthRequest):
    user = get_request_user(request)
    return {
        "status": "success",
        "messages": [message.dict() for message in messages.recent]
    }


@app.post("/api/status")
async def status(request: AuthRequest):
    user = get_request_user(request)
    return {"status": "success", "username": user.name, "gm": user.is_gm}


class ListFilesRequest(AuthRequest):
    path: str


@app.post("/api/files/list")
async def list_files(request: ListFilesRequest):
    user = get_request_user(request)
    # Make sure path is absolute
    path = Path(request.path)
    if not path.is_absolute():
        return {"status": "error", "reason": "not an absolute path"}
    # Resolve '..' and symlinks in path
    path = path.resolve(strict=False)
    # Make path relative to user root
    if user.is_gm:
        user_root = FILES_ROOT
    else:
        user_root = FILES_ROOT / user.name
    path = user_root / Path(str(path)[1:])
    # Check that path is a directory that exists
    if not path.is_dir():
        return {"status": "error", "reason": "not a directory"}
    # Get list of files
    if path == user_root:
        returned_path = "/"
    else:
        returned_path = "/" + str(path.relative_to(user_root))
    return {
        "status": "success",
        "path": returned_path,
        "files": [
            (
                files.sniff(subpath),
                "/" + str(subpath.relative_to(user_root))
            )
            for subpath in path.iterdir()
        ]
    }


@app.on_event("shutdown")
async def shutdown():
    print("Saving database ...")
    db.save()
