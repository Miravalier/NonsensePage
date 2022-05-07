from __future__ import annotations

import pickle
from dataclasses import dataclass, field
from pathlib import Path
from pydantic import BaseModel, Field
from typing import Optional, Set, List, Dict, Union

from connections import Pool
from enums import Alignment, Language, Permissions
from utils import random_id


DATABASE_ROOT = Path("/data/db/")
ENTRY_POOLS: Dict[str, Pool] = {}


def new_permissions():
    return {"*": {"*": Permissions.NONE}}


@dataclass
class Stat:
    name: str
    value: Union[int,str]


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
        self.add_collection("entries", self.id)
        db.persist_queue.add(self)

    @property
    def pool(self):
        pool = ENTRY_POOLS.get(self.id)
        if pool is None:
            pool = Pool()
            ENTRY_POOLS[self.id] = pool
        return pool

    async def broadcast_update(self):
        await self.pool.broadcast({"pool": self.id, "type": "update", "entry": self.dict()})

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
        db.persist_queue.discard(self)
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
        # Resolve inherited permissions for specific IDs
        if id != "*" and field_permission == Permissions.INHERIT:
            return self.get_permission("*", field)
        return field_permission

    def set_permission(self, id: str = "*", field: str = "*", level: Permissions = Permissions.READ):
        if id not in self.permissions:
            self.permissions[id] = {"*": Permissions.INHERIT}
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


@dataclass
class Database:
    # Attributes
    persist_queue: Set[Entry] = field(default_factory=set)
    # Collections
    entries: Dict[str, Entry] = field(default_factory=dict)
    users: Dict[str, User] = field(default_factory=dict)
    users_by_token: Dict[str, User] = field(default_factory=dict)
    users_by_name: Dict[str, User] = field(default_factory=dict)
    characters: Dict[str, Character] = field(default_factory=dict)
    items: Dict[str, Item] = field(default_factory=dict)
    containers: Dict[str, Container] = field(default_factory=dict)
    entities: Dict[str, Entity] = field(default_factory=dict)

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


class Entity(Entry):
    stat_map: Dict[str, Stat] = Field(default_factory=dict)
    stat_order: List[str] = Field(default_factory=list)

    def post_create(self):
        super().post_create()
        self.add_collection("entities", self.id)

    def set_stat(self, name: str, value: Union[str, int, None]):
        if value is None:
            if name in self.stat_map:
                self.stat_order.remove(name)
                self.stat_map.pop(name)
        else:
            stat = self.stat_map.get(name)
            if stat is None:
                self.stat_order.append(name)
                self.stat_map[name] = Stat()
            else:
                stat.value = value
        db.persist_queue.add(self)

    def move_stat_up(self, id: str):
        index = self.stat_order.index(id)
        if len(self.stat_order) <= 1:
            return
        if index == 0:
            return
        previous = self.stat_order[index - 1]
        self.stat_order[index - 1] = self.stat_order[index]
        self.stat_order[index] = previous
        db.persist_queue.add(self)

    def move_stat_down(self, id: str):
        index = self.stat_order.index(id)
        if len(self.stat_order) <= 1:
            return
        if index == len(self.stat_order) - 1:
            return
        next = self.stat_order[index + 1]
        self.stat_order[index + 1] = self.stat_order[index]
        self.stat_order[index] = next
        db.persist_queue.add(self)


class Container(Entry):
    item_order: List[str] = Field(default_factory=list)

    def post_create(self):
        super().post_create()
        self.add_collection("containers", self.id)

    def delete(self):
        for item in self.items:
            item.container_id = None
            item.delete()
        super().delete()

    @property
    def stats(self):
        for stat in self.stat_order:
            yield self.stat_map[stat]

    @property
    def items(self):
        for id in self.item_order:
            yield db.items[id]

    def create_item(self, name: str = "New Item", description: str = "") -> Item:
        item = Item.create(name=name, description=description, container_id=self.id)
        self.item_order.append(item.id)
        db.persist_queue.add(self)
        return item

    def move_item_up(self, id: str):
        index = self.item_order.index(id)
        if len(self.item_order) <= 1:
            return
        if index == 0:
            return
        previous = self.item_order[index - 1]
        self.item_order[index - 1] = self.item_order[index]
        self.item_order[index] = previous
        db.persist_queue.add(self)

    def move_item_down(self, id: str):
        index = self.item_order.index(id)
        if len(self.item_order) <= 1:
            return
        if index == len(self.item_order) - 1:
            return
        next = self.item_order[index + 1]
        self.item_order[index + 1] = self.item_order[index]
        self.item_order[index] = next
        db.persist_queue.add(self)


class Item(Entity, Container):
    name: str
    description: str = ""
    container_id: Optional[str] = None

    def post_create(self):
        super().post_create()
        self.add_collection("items", self.id)

    def delete(self):
        container = db.containers.get(self.container_id, None)
        if container is not None:
            container.item_order.remove(self.id)
            db.persist_queue.add(container)
        super().delete()


class Character(Entity, Container):
    name: str
    description: str = ""
    alignment: Alignment = Alignment.NEUTRAL
    languages: Set[Language] = Field(default_factory=set)
    hp: int = 0
    max_hp: int = 0
    size: int = 1
    scale: float = 1.0

    def post_create(self):
        super().post_create()
        self.add_collection("characters", self.id)
        self.languages.add(Language.COMMON)


class User(Entry):
    name: str
    hashed_password: bytes
    is_gm: bool = False
    character_id: Optional[str] = None

    def post_create(self):
        super().post_create()
        self.add_collection("users", self.id)
        self.add_collection("users_by_name", self.name)

    @property
    def languages(self):
        if self.character_id is not None:
            character = db.characters.get(self.character_id, None)
            if character is not None:
                return character.languages
        return {Language.COMMON}


db = Database.load()
