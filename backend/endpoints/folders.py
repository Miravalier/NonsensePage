from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter
from pydantic.functional_validators import AfterValidator
from typing import Annotated, Optional
from enum import Enum

from ..lib import database
from ..lib.utils import require, auth_require, pluralize
from ..models.database_models import Permissions, get_pool, Entry, Folder
from ..models.request_models import AuthRequest, GMRequest


def delete_folder(collection: str, folder: Folder):
    # Delete the folder itself
    folders: database.DocumentCollection[Folder] = getattr(database, f"{collection}_folders")
    folders.delete_one(folder.id)
    # Delete all entries in this folder
    entryCollection: database.DocumentCollection[Entry] = getattr(database, f"{pluralize(collection)}")
    entryCollection.delete_many({"folder_id": folder.id})
    # Recursively delete all child folders
    for subfolder in folders.find({"parent_id": folder.id}):
        delete_folder(collection, subfolder)


def set_folder_permissions(collection: str, folder: Folder, permissions: dict):
    entryCollection: database.DocumentCollection[Entry] = getattr(database, f"{pluralize(collection)}")
    entryCollection.update_many({"folder_id": folder.id}, {"$set": {"permissions": permissions}})

    folders: database.DocumentCollection[Folder] = getattr(database, f"{collection}_folders")
    for subfolder in folders.find({"parent_id": folder.id}):
        set_folder_permissions(collection, subfolder, permissions)

    return {"status": "success"}


router = APIRouter()


def validate_entry_type(value: str):
    if value not in ["character", "ability", "note"]:
        raise ValueError("invalid entry type")
    return value


EntryType = Annotated[str, AfterValidator(validate_entry_type)]


class FolderMoveRequest(AuthRequest):
    entry_id: Optional[str] = None
    folder_id: Optional[str] = None
    dst_id: Optional[str] = None


@router.post("/{entryType}/move")
async def folder_move(request: FolderMoveRequest, entryType: EntryType):
    folders: database.DocumentCollection[Folder] = getattr(database, f"{entryType}_folders")
    entryCollection: database.DocumentCollection[Entry] = getattr(database, f"{pluralize(entryType)}")

    if request.dst_id is not None:
        dst_folder = require(folders.find_one(request.dst_id), "invalid folder id")
        if not request.requester.is_gm:
            auth_require(dst_folder.has_permission(request.requester.id, "*", Permissions.WRITE))

    require(request.entry_id or request.folder_id, "no src specified")
    require(not (request.entry_id and request.folder_id), "both folder and entry id specified")

    if request.entry_id is not None:
        entry = require(entryCollection.find_one(request.entry_id), f"invalid {entryType} id")
        require(entry.folder_id != request.dst_id, "src and dst folder must differ")
        if not request.requester.is_gm:
            auth_require(entry.has_permission(request.requester.id, "*", Permissions.OWNER))
        entryCollection.find_one_and_update(request.entry_id, {"$set": {"folder_id": request.dst_id}})
        await entry.pool.broadcast({
            "type": "move",
            "src": entry.folder_id,
            "dst": request.dst_id,
        })
        await get_pool(pluralize(entryType)).broadcast({
            "type": "move",
            "src": entry.folder_id,
            "dst": request.dst_id,
            "id": entry.id,
            "name": entry.name,
            "image": entry.image,
        })

    if request.folder_id is not None:
        require(request.folder_id != request.dst_id, "folder cannot contain itself")
        folder = require(folders.find_one(request.folder_id), "invalid folder id")
        require(folder.parent_id != request.dst_id, "src and dst folder must differ")
        if not request.requester.is_gm:
            auth_require(folder.has_permission(request.requester.id, "*", Permissions.OWNER))
        folders.find_one_and_update(request.folder_id, {"$set": {"parent_id": request.dst_id}})
        await get_pool(pluralize(entryType)).broadcast({
            "type": "movedir",
            "src": folder.parent_id,
            "dst": request.dst_id,
            "id": folder.id,
            "name": folder.name,
        })
    return {"status": "success"}


class ListRequest(AuthRequest):
    folder_id: Optional[str] = None


@router.post("/{entryType}/list")
async def folder_list(request: ListRequest, entryType: EntryType):
    folders: database.DocumentCollection[Folder] = getattr(database, f"{entryType}_folders")
    entryCollection: database.DocumentCollection[Entry] = getattr(database, f"{pluralize(entryType)}")

    if request.folder_id is not None:
        try:
            folder = require(folders.find_one({"$or": [
                {"_id": ObjectId(request.folder_id)},
                {"alternate_id": request.folder_id},
            ]}), "invalid folder id")
        except InvalidId:
            folder = require(folders.find_one({
                "alternate_id": request.folder_id
            }), "invalid folder id")

        folder_id = folder.id
        folder_name = folder.name
        parent_id = folder.parent_id
    else:
        folder_id = None
        folder_name = "/"
        parent_id = None

    subfolders = []
    for folder in folders.find({"parent_id": folder_id}):
        if request.requester.is_gm or folder.has_permission(request.requester.id, level=Permissions.READ):
            subfolders.append((folder.id, folder.name))
    subfolders.sort(key=lambda f: f[1])

    entries = []
    for entry in entryCollection.find({"folder_id": folder_id}):
        if request.requester.is_gm or entry.has_permission(request.requester.id, level=Permissions.READ):
            entries.append(entry.model_dump())
    entries.sort(key=lambda entry: entry["name"])

    return {
        "status": "success",
        "name": folder_name,
        "parent_id": parent_id,
        "subfolders": subfolders,
        "entries": entries
    }


class FolderRenameRequest(AuthRequest):
    id: str
    name: str


@router.post("/{entryType}/rename")
async def folder_rename(request: FolderRenameRequest, entryType: EntryType):
    folders: database.DocumentCollection[Folder] = getattr(database, f"{entryType}_folders")

    folder = require(folders.find_one(request.id), "invalid folder id")
    if not request.requester.is_gm:
        auth_require(folder.has_permission(request.requester.id, "*", Permissions.OWNER))

    folders.find_one_and_update(request.id, {"$set": {"name": request.name}})

    await get_pool(pluralize(entryType)).broadcast({
        "type": "renamedir",
        "folder": request.id,
        "name": request.name,
    })
    return {"status": "success"}


class FolderCreateRequest(AuthRequest):
    name: str
    parent: Optional[str] = None


@router.post("/{entryType}/create")
async def folder_create(request: FolderCreateRequest, entryType: EntryType):
    folders: database.DocumentCollection[Folder] = getattr(database, f"{entryType}_folders")

    if request.parent is not None:
        require(folders.find_one(request.parent), "invalid folder id")

    options = {"name": request.name, "parent_id": request.parent}
    if not request.requester.is_gm:
        options["permissions"] = {"*": {"*": Permissions.READ}, request.requester.id: {"*": Permissions.OWNER}}

    folder = folders.create(options)

    await get_pool(pluralize(entryType)).broadcast({
        "type": "mkdir",
        "folder": request.parent,
        "id": folder.id,
        "name": folder.name,
    })
    return {"status": "success", "id": folder.id}


class FolderDeleteRequest(AuthRequest):
    folder_id: str


@router.post("/{entryType}/delete")
async def folder_delete(request: FolderDeleteRequest, entryType: EntryType):
    folders: database.DocumentCollection[Folder] = getattr(database, f"{entryType}_folders")

    folder = require(folders.find_one(request.folder_id), "invalid folder id")

    if not request.requester.is_gm:
        auth_require(folder.has_permission(request.requester.id, "*", Permissions.OWNER))

    delete_folder(entryType, folder)

    await get_pool(pluralize(entryType)).broadcast({
        "type": "rmdir",
        "folder": folder.id,
    })
    return {"status": "success"}


class FolderSetAltIdRequest(GMRequest):
    folder_id: str
    alternate_id: str


@router.post("/{entryType}/alt-id")
async def folder_alt_id(request: FolderSetAltIdRequest, entryType: EntryType):
    folders: database.DocumentCollection[Folder] = getattr(database, f"{entryType}_folders")

    require(folders.find_one_and_update(
        request.folder_id,
        {"$set": {"alternate_id": request.alternate_id}}
    ), "invalid folder_id")
    return {"status": "success"}


class FolderUpdatePermissionsRequest(GMRequest):
    folder_id: str
    permissions: dict


@router.post("/{entryType}/update-permissions")
async def folder_set_permissions(request: FolderUpdatePermissionsRequest, entryType: EntryType):
    folders: database.DocumentCollection[Folder] = getattr(database, f"{entryType}_folders")
    folder = require(folders.find_one(request.folder_id), "invalid folder id")

    set_folder_permissions(entryType, folder, request.permissions)

    return {"status": "success"}
