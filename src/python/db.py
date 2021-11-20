from __future__ import annotations

import os
import pickle
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterator, Optional, Type, TypeVar, Union

from pydantic import BaseModel
from strawberry.types.info import Info

from enums import Permissions

T = TypeVar("T")


class Database(dict):
    def __init__(self, path: str = "/data/db/"):
        super().__init__()
        self.path = Path(path)
        self.path.mkdir(exist_ok=True)

    def __iter__(self) -> Iterator[Collection]:
        return iter(self.values())

    def __getattr__(self, name: str) -> Collection:
        return self[name]

    def __getitem__(self, k: str) -> Collection:
        try:
            return super().__getitem__(k)
        except KeyError:
            collection = Collection(self, self.path / k)
            self[k] = collection
            return collection

    def save(self):
        for collection in self.values():
            collection.save()

    def load(self):
        for path in self.path.iterdir():
            if path.is_dir():
                self[path.stem].load()


class Collection(dict):
    def __init__(self, database: Database, path: Path):
        super().__init__()
        self.database = database
        self.path = path
        self.name = path.name
        self.persisted = False
        self.indices: Dict[str, Dict[str, str]] = {}

    def index_get(self, index: str, key: str) -> Optional[DBEntry]:
        id = self.indices.get(index, {}).get(key, None)
        return self[id]

    def index_set(self, index: str, key: str, id: str):
        self.persisted = False
        if index not in self.indices:
            self.indices[index] = {}
        self.indices[index][key] = id

    def index_delete(self, index: str, key: str):
        self.persisted = False
        if index not in self.indices:
            return
        self.indices[index].pop(key, None)

    def __getitem__(self, k: str) -> Optional[DBEntry]:
        try:
            return super().__getitem__(k)
        except KeyError:
            return None

    def __iter__(self) -> Iterator[DBEntry]:
        return iter(self.values())

    def add(self, data: Union[BaseModel, Dict[str, Any]]) -> DBEntry:
        if isinstance(data, BaseModel):
            data: Dict[str, Any] = data.dict()
        entry_id = data.get("id", None)
        if entry_id is None:
            raise ValueError("No id field present in entry")
        entry = DBEntry(self, self.path / entry_id, data)
        self[entry_id] = entry
        self.persisted = False
        return entry

    def delete(self, id: Union[BaseModel, str]):
        if isinstance(id, BaseModel):
            id: str = id.id
        del self[id]
        os.unlink(self.path / id)

    def save(self):
        if self.persisted:
            return

        self.path.mkdir(exist_ok=True)

        with open(self.path / "_index", "wb") as f:
            pickle.dump(self.indices, f)

        for entry in self.values():
            entry.save()

        self.persisted = True

    def load(self):
        try:
            with open(self.path / "_index", "rb") as f:
                self.indices = pickle.load(f)
        except FileNotFoundError:
            pass

        for path in self.path.iterdir():
            if path.name.startswith("_"):
                continue
            if path.is_file():
                entry = DBEntry.load(path)
                entry.path = path
                entry.collection = self
                self[path.stem] = entry

        self.persisted = True


def permissions_factory():
    return {"*": {"*": Permissions.NONE}}


@dataclass
class DBEntry:
    collection: Collection
    path: Path
    data: Dict[str, Any] = field(default_factory=dict)
    permissions: Dict[str, Dict[str, Permissions]] = field(default_factory=permissions_factory)
    counters: Counter = field(default_factory=Counter)
    persisted: bool = False

    @property
    def id(self):
        return self.data["id"]

    def as_schema(self, schema: Type[T], info: Info) -> T:
        if hasattr(schema, "from_db_entry"):
            return schema.from_db_entry(self, info)
        else:
            return schema(**self.data)

    def has_permission(self, id: str = "*", field: str = "*", level: Permissions = Permissions.READ) -> bool:
        # Get the permissions associated with the requesting user
        permissions = self.permissions.get(id, None)
        if permissions is None:
            permissions = self.permissions.get("*", {"*": Permissions.NONE})
        # Get the permission associated with the exact field
        permission = permissions.get(field, None)
        if permission is None:
            permission = permissions.get("*", Permissions.NONE)
        return permission >= level

    def __getstate__(self):
        state = self.__dict__.copy()
        del state["collection"]
        del state["counters"]
        del state["persisted"]
        del state["path"]
        return state

    def __setstate__(self, state: dict):
        self.__dict__.update(state)
        self.collection = None
        self.counters = Counter()
        self.persisted = True
        self.path = None

    def update(self, data: Dict[str, Any]):
        self.persisted = False
        self.collection.persisted = False
        for key, value in data.items():
            self.data[key] = value
            self.counters[key] += 1

    def save(self):
        if self.persisted:
            return

        with open(self.path, "wb") as f:
            pickle.dump(self, f)

        self.persisted = True

    @staticmethod
    def load(path: Path) -> DBEntry:
        with open(path, "rb") as f:
            return pickle.load(f)


db = Database()
db.load()
