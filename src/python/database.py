from __future__ import annotations

import pickle
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from pydantic import BaseModel, Field
from typing import Set, List, Dict

from enums import Alignment, Permissions
from utils import random_id


DATABASE_ROOT = Path("/data/db/")


def new_permissions():
    return {"*": {"*": Permissions.NONE}}


class Entry(BaseModel):
    id: str = Field(default_factory=random_id)
    collections: Dict[str, str] = Field(default_factory=dict)
    permissions: Dict[str, Dict[str, Permissions]] = Field(default_factory=new_permissions)

    def __setattr__(self, name, value):
        db.persist_queue.add(self)
        return super().__setattr__(name, value)

    def __hash__(self):
        return hash(self.id)

    def post_create(self):
        db.persist_queue.add(self)

    @classmethod
    def create(cls, **kwargs):
        obj = cls.parse_obj(kwargs)
        obj.post_create()
        return obj

    def delete(self):
        # Remove self from any relevant collections
        for collection, key in self.collections.items():
            del getattr(db, collection)[key]
        # Make sure this object isn't re-persisted after delete
        db.persist_queue.remove(self)
        # Delete actual file
        (DATABASE_ROOT / self.id).unlink(missing_ok=True)

    def add_collection(self, collection: str, key: str):
        """
        Add this entry to the database in a particular collection.
        """
        db.persist_queue.add(self)
        self.collections[collection] = key
        getattr(db, collection)[key] = self

    def get_permission(self, id: str = "*", field: str = "*") -> Permissions:
        """
        Get the permissions enum for the given ID accessing the given field
        on this entry.
        """
        # Get the permissions associated with the requesting entity
        entity_permissions = self.permissions.get(id, None)
        if entity_permissions is None:
            entity_permissions = self.permissions.get("*", {"*": Permissions.NONE})
        # Get the permission associated with the exact field
        field_permission = entity_permissions.get(field, None)
        if field_permission is None:
            field_permission = entity_permissions.get("*", Permissions.NONE)
        return field_permission

    def set_permission(self, id: str = "*", field: str = "*", level: Permissions = Permissions.READ):
        if id not in self.permissions:
            self.permissions[id] = {"*": Permissions.NONE}
        self.permissions[id][field] = level

    def has_permission(self, id: str = "*", field: str = "*", level: Permissions = Permissions.READ) -> bool:
        permission = self.get_permission(id, field)
        return permission >= level

    def add_permission(self, id: str = "*", field: str = "*", level: Permissions = Permissions.READ):
        if not self.has_permission(id, field, level):
            self.set_permission(id, field, level)

    def clear_permissions(self, id: str = "*"):
        if id == "*":
            self.permissions[id] = {"*": Permissions.NONE}
        else:
            self.permissions.pop(id, None)


class Message(Entry):
    timestamp: datetime
    language: str
    content: str
    sender_id: str
    speaker_id: str
    speaker_name: str

    def post_create(self):
        super().post_create()
        self.add_collection("messages", self.id)


class Character(Entry):
    name: str
    alignment: Alignment
    owner_id: str
    languages: List[str]

    def post_create(self):
        super().post_create()
        self.add_collection("characters", self.id)


class User(Entry):
    name: str
    hashed_password: bytes
    is_gm: bool = False
    character_id: str = ""

    def post_create(self):
        super().post_create()
        self.add_collection("users", self.id)
        self.add_collection("users_by_name", self.name)


@dataclass
class Database:
    # Attributes
    persist_queue: Set[Entry] = field(default_factory=set)
    # Collections
    users: Dict[str, User] = field(default_factory=dict)
    users_by_token: Dict[str, User] = field(default_factory=dict)
    users_by_name: Dict[str, User] = field(default_factory=dict)
    characters: Dict[str, Character] = field(default_factory=dict)
    messages: Dict[str, Message] = field(default_factory=dict)

    def save(self):
        DATABASE_ROOT.mkdir(parents=True, exist_ok=True)
        for entry in self.persist_queue:
            with open(DATABASE_ROOT / entry.id, "wb") as pickle_file:
                pickle.dump(entry, pickle_file)
        self.persist_queue = set()

    @classmethod
    def load(cls):
        DATABASE_ROOT.mkdir(parents=True, exist_ok=True)
        db = cls()
        for path in DATABASE_ROOT.iterdir():
            with open(path, "rb") as pickle_file:
                entry: Entry = pickle.load(pickle_file)
            for collection, key in entry.collections.items():
                getattr(db, collection)[key] = entry
        return db


db = Database.load()
