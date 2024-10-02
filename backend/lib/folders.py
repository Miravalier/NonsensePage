from . import database
from .utils import pluralize
from ..models.database_models import Entry, Folder


def delete_folder(collection: str, folder: Folder):
    # Delete the folder itself
    folders: database.DocumentCollection[Folder] = getattr(database, f"{collection}_folders")
    folders.delete_one(folder.id)
    # Delete all characters in this folder
    entries: database.DocumentCollection[Entry] = getattr(database, f"{pluralize(collection)}")
    entries.delete_many({"folder_id": folder.id})
    # Recursively delete all child folders
    for subfolder in folders.find({"parent_id": folder.id}):
        delete_folder(subfolder)
