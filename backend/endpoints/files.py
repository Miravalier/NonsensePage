import shutil
from fastapi import APIRouter, Form, UploadFile, File
from pathlib import Path

from ..lib import database
from ..lib.errors import AuthError, JsonError
from ..lib.files import sniff, validate_directory, validate_path, generate_thumbnail, delete_thumbnail
from ..models.database_models import Session, User, get_pool
from ..models.request_models import AuthRequest


router = APIRouter()


class CreateFolderRequest(AuthRequest):
    path: str
    name: str


@router.post("/mkdir")
async def files_mkdir(request: CreateFolderRequest):
    path = validate_directory(request.requester, request.path)
    new_path = path / request.name
    try:
        new_path.mkdir()
    except FileExistsError:
        raise JsonError("directory already exists")
    await get_pool("files").broadcast({
        "type": "mkdir",
        "user": request.requester.id,
        "path": str(Path(request.path) / request.name),
    })
    return {"status": "success"}


def recursive_delete(path: Path):
    if path.is_dir():
        for sub_path in list(path.iterdir()):
            recursive_delete(sub_path)
        path.rmdir()
    else:
        path.unlink()
        delete_thumbnail(path)


class DeleteFileRequest(AuthRequest):
    path: str


@router.post("/delete")
async def delete_file(request: DeleteFileRequest):
    path = validate_path(request.requester, request.path)
    # Check that path is a file or directory that exists
    if not path.exists():
        raise JsonError("path does not exist")
    recursive_delete(path)
    await get_pool("files").broadcast({
        "type": "delete",
        "user": request.requester.id,
        "path": request.path,
    })
    return {"status": "success"}


@router.post("/upload")
async def upload_file(token: str = Form(...), path: str = Form(...), file: UploadFile = File(...)):
    session: Session = database.sessions.find_one({"auth_token": token})
    if session is None:
        raise AuthError("invalid token")

    requester: User = database.users.find_one(session.user_id)
    if requester is None:
        raise AuthError("valid token for deleted user")

    resolved_path = validate_directory(requester, path)

    # Copy file to permanent location
    with open(resolved_path / file.filename, "wb") as f:
        shutil.copyfileobj(file.file, f)

    await get_pool("files").broadcast({
        "type": "upload",
        "user": requester.id,
        "path": str(Path(path) / file.filename),
    })
    return {"status": "success"}


class MoveFileRequest(AuthRequest):
    src: str
    dst: str


@router.post("/move")
async def move_file(request: MoveFileRequest):
    # Validate paths
    src = validate_path(request.requester, request.src)
    dst = validate_path(request.requester, request.dst)
    src.rename(dst)
    await get_pool("files").broadcast({
        "type": "rename",
        "user": request.requester.id,
        "src": str(src),
        "dst": str(dst),
    })
    return {"status": "success"}


class ListFilesRequest(AuthRequest):
    path: str


@router.post("/list")
async def list_files(request: ListFilesRequest):
    # Validate path
    path = validate_directory(request.requester, request.path)
    # Make path relative to user root
    user_root = request.requester.file_root
    # Get list of files
    if path == user_root:
        returned_path = "/"
    else:
        returned_path = "/" + str(path.relative_to(user_root))

    results = [
        (
            sniff(subpath),
            "/" + str(subpath.relative_to(user_root))
        )
        for subpath in path.iterdir()
    ]
    results.sort()

    for file_type, file_path in results:
        if file_type == "image/gif":
            pass # Don't thumbnail GIFs
        elif file_type == "image/svg":
            generate_thumbnail(user_root / file_path.lstrip("/"), svg=True)
        elif file_type.startswith("image/"):
            generate_thumbnail(user_root / file_path.lstrip("/"))

    return {
        "status": "success",
        "path": returned_path,
        "files": results
    }
