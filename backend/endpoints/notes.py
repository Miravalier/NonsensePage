from fastapi import APIRouter

from ..lib import database
from ..lib.errors import JsonError
from ..lib.utils import require, auth_require
from ..models.database_models import Note, Permissions, get_pool
from ..models.request_models import AuthRequest


router = APIRouter()


class NoteCreateRequest(AuthRequest):
    document: Note


@router.post("/create")
async def note_create(request: NoteCreateRequest):
    note = request.document

    if note.name is None:
        note.name = "New Note"

    if not request.requester.is_gm:
        note.add_permission("*", "*", Permissions.READ)
        note.add_permission(request.requester.id, "*", Permissions.OWNER)

    if note.folder_id is not None:
        folder = require(database.note_folders.find_one(note.folder_id), "invalid folder id")
        if not request.requester.is_gm:
            auth_require(folder.has_permission(request.requester.id, "*", Permissions.WRITE))

    note = database.notes.create(note.model_dump(exclude_defaults=True))

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
