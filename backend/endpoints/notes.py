from fastapi import APIRouter
from typing import Optional

from ..lib import database
from ..lib.errors import JsonError
from ..lib.folders import delete_folder
from ..lib.utils import require, auth_require
from ..models.database_models import Permissions, get_pool
from ..models.request_models import AuthRequest


router = APIRouter()


class NoteCreateRequest(AuthRequest):
    name: str
    folder_id: Optional[str] = None


@router.post("/create")
async def note_create(request: NoteCreateRequest):
    options = {"name": request.name}
    if not request.requester.is_gm:
        options["permissions"] = {"*": {"*": Permissions.READ}, request.requester.id: {"*": Permissions.OWNER}}
    if request.folder_id is not None:
        folder = require(database.note_folders.find_one(request.folder_id), "invalid folder id")
        if not request.requester.is_gm:
            auth_require(folder.has_permission(request.requester.id, "*", Permissions.WRITE))
        options["folder_id"] = request.folder_id

    note = database.notes.create(options)

    await get_pool("notes").broadcast({
        "type": "create",
        "folder": note.folder_id,
        "id": note.id,
        "name": note.name,
    })
    return {"status": "success", "id": note.id}


class NoteDeleteRequest(AuthRequest):
    id: str


@router.post("/delete")
async def note_delete(request: NoteDeleteRequest):
    note = require(database.notes.find_one(request.id), "invalid note id")
    if not request.requester.is_gm:
        auth_require(note.has_permission(request.requester.id, "*", Permissions.OWNER))
    database.notes.delete_one(note.id)
    await note.pool.broadcast({
        "type": "delete",
    })
    await get_pool("notes").broadcast({
        "type": "delete",
        "folder": note.folder_id,
        "id": note.id,
    })
    return {"status": "success"}


class NoteUpdateRequest(AuthRequest):
    id: str
    changes: dict


@router.post("/update")
async def note_update(request: NoteUpdateRequest):
    note = require(database.notes.find_one(request.id), "invalid note id")
    if not request.requester.is_gm:
        auth_require(note.has_permission(request.requester.id, "*", Permissions.WRITE))

    database.notes.find_one_and_update(request.id, request.changes)

    await note.broadcast_changes(request.changes)

    if name := request.changes.get("$set", {}).get("name", None):
        await get_pool("notes").broadcast({
            "type": "rename",
            "folder": note.folder_id,
            "id": request.id,
            "name": name,
        })

    return {"status": "success"}


class NoteGetRequest(AuthRequest):
    id: str = None
    name: str = None


@router.post("/get")
async def note_get(request: NoteGetRequest):
    if request.id is None and request.name is None:
        raise JsonError("get note by either id or name, passed neither")
    if request.id is not None and request.name is not None:
        raise JsonError("get note by either id or name, passed both")

    if request.id:
        note = require(database.notes.find_one(request.id), "invalid note id")
    else:
        note = require(database.notes.find_one({"name": request.name}), "invalid note name")

    require(request.requester.is_gm or note.has_permission(request.requester.id, "*", Permissions.READ))
    return {"status": "success", "note": note.model_dump()}


class NoteListRequest(AuthRequest):
    folder_id: Optional[str] = None


@router.post("/list")
async def note_list(request: NoteListRequest):
    if request.folder_id is not None:
        folder = require(database.note_folders.find_one(request.folder_id), "invalid folder id")
        folder_name = folder.name
        parent_id = folder.parent_id
    else:
        folder_name = "/"
        parent_id = None
    subfolders = []
    notes = []
    if request.requester.is_gm:
        for folder in database.note_folders.find({"parent_id": request.folder_id}):
            subfolders.append((folder.id, folder.name))
        for note in database.notes.find({"folder_id": request.folder_id}):
            notes.append((note.id, note.name, note.image))

    else:
        for folder in database.note_folders.find({"parent_id": request.folder_id}):
            if folder.has_permission(request.requester.id, level=Permissions.READ):
                subfolders.append((folder.id, folder.name))
        for note in database.notes.find({"folder_id": request.folder_id}):
            if note.has_permission(request.requester.id, level=Permissions.READ):
                notes.append((note.id, note.name, note.image))
    subfolders.sort(key=lambda f: f[1])
    notes.sort(key=lambda c: c[1])
    return {
        "status": "success",
        "name": folder_name,
        "parent_id": parent_id,
        "subfolders": subfolders,
        "entries": notes
    }


class NoteMoveRequest(AuthRequest):
    note_id: Optional[str] = None
    folder_id: Optional[str] = None
    dst_id: Optional[str] = None


@router.post("/move")
async def note_move(request: NoteMoveRequest):
    if request.dst_id is not None:
        dst_folder = require(database.note_folders.find_one(request.dst_id), "invalid folder id")
        if not request.requester.is_gm:
            auth_require(dst_folder.has_permission(request.requester.id, "*", Permissions.WRITE))

    require(request.note_id or request.folder_id, "no src specified")
    require(not (request.note_id and request.folder_id), "both folder and note ids specified")

    if request.note_id is not None:
        note = require(database.notes.find_one(request.note_id), "invalid note id")
        require(note.folder_id != request.dst_id, "src and dst folder must differ")
        if not request.requester.is_gm:
            auth_require(note.has_permission(request.requester.id, "*", Permissions.OWNER))
        database.notes.find_one_and_update(request.note_id, {"$set": {"folder_id": request.dst_id}})
        await note.pool.broadcast({
            "type": "move",
            "src": note.folder_id,
            "dst": request.dst_id,
        })
        await get_pool("notes").broadcast({
            "type": "move",
            "src": note.folder_id,
            "dst": request.dst_id,
            "id": note.id,
            "name": note.name,
            "image": note.image,
        })

    if request.folder_id is not None:
        require(request.folder_id != request.dst_id, "folder cannot contain itself")
        folder = require(database.note_folders.find_one(request.folder_id), "invalid folder id")
        require(folder.parent_id != request.dst_id, "src and dst folder must differ")
        if not request.requester.is_gm:
            auth_require(folder.has_permission(request.requester.id, "*", Permissions.OWNER))
        database.note_folders.find_one_and_update(request.folder_id, {"$set": {"parent_id": request.dst_id}})
        await get_pool("notes").broadcast({
            "type": "movedir",
            "src": folder.parent_id,
            "dst": request.dst_id,
            "id": folder.id,
            "name": folder.name,
        })
    return {"status": "success"}


class NoteFolderRenameRequest(AuthRequest):
    id: str
    name: str


@router.post("/folder/rename")
async def note_folder_rename(request: NoteFolderRenameRequest):
    folder = require(database.note_folders.find_one(request.id), "invalid folder id")
    if not request.requester.is_gm:
        auth_require(folder.has_permission(request.requester.id, "*", Permissions.OWNER))
    database.note_folders.find_one_and_update(request.id, {"$set": {"name": request.name}})
    await get_pool("notes").broadcast({
        "type": "renamedir",
        "folder": request.id,
        "name": request.name,
    })
    return {"status": "success"}


class NoteFolderCreateRequest(AuthRequest):
    name: str
    parent: Optional[str] = None


@router.post("/folder/create")
async def note_folder_create(request: NoteFolderCreateRequest):
    if request.parent is not None:
        require(database.note_folders.find_one(request.parent), "invalid folder id")
    options = {"name": request.name, "parent_id": request.parent}
    if not request.requester.is_gm:
        options["permissions"] = {"*": {"*": Permissions.READ}, request.requester.id: {"*": Permissions.OWNER}}
    folder = database.note_folders.create(options)
    await get_pool("notes").broadcast({
        "type": "mkdir",
        "folder": request.parent,
        "id": folder.id,
        "name": folder.name,
    })
    return {"status": "success", "id": folder.id}


class NoteFolderDeleteRequest(AuthRequest):
    folder_id: str


@router.post("/folder/delete")
async def note_folder_delete(request: NoteFolderDeleteRequest):
    folder = require(database.note_folders.find_one(request.folder_id), "invalid folder id")
    if not request.requester.is_gm:
        auth_require(folder.has_permission(request.requester.id, "*", Permissions.OWNER))
    delete_folder("note", folder)
    await get_pool("notes").broadcast({
        "type": "rmdir",
        "folder": folder.id,
    })
    return {"status": "success"}
