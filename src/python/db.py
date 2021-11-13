from __future__ import annotations

import os
import pickle
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterator, Optional

from permissions import Permissions


class Database(dict):
    def __init__(self, path: str = "/data/db/"):
        super().__init__()
        self.path = Path(path)
        self.persisted = False

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
        if self.persisted:
            return

        self.path.mkdir(exist_ok=True)

        for collection in self.values():
            collection.save()

        self.persisted = True

    def load(self):
        if self.persisted:
            return

        self.path.mkdir(exist_ok=True)

        for path in self.path.iterdir():
            if path.is_dir():
                self[path.stem].load()

        self.persisted = True


class Collection(dict):
    def __init__(self, database: Database, path: Path):
        super().__init__()
        self.database = database
        self.path = path
        self.persisted = False
        self.indices: Dict[str, Dict[str, str]] = {}

    def index_get(self, index: str, key: str) -> Optional[Entry]:
        id = self.indices.get(index, {}).get(key, None)
        return self[id]

    def index_set(self, index: str, key: str, id: str):
        if index not in self.indices:
            self.indices[index] = {}
        self.indices[index][key] = id

    def index_delete(self, index: str, key: str):
        if index not in self.indices:
            return
        self.indices[index].pop(key, None)

    def __getitem__(self, k: str) -> Optional[Entry]:
        try:
            return super().__getitem__(k)
        except KeyError:
            return None

    def __iter__(self) -> Iterator[Entry]:
        return iter(self.values())

    def add(self, data: Dict[str, Any]) -> Entry:
        entry_id = data.get("id", None)
        if entry_id is None:
            raise ValueError("No id field present in entry")
        entry = Entry(self, self.path / entry_id, data)
        self[entry_id] = entry
        self.persisted = False
        self.database.persisted = False
        return entry

    def delete(self, id):
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
        if self.persisted:
            return

        try:
            with open(self.path / "_index", "rb") as f:
                self.indices = pickle.load(f)
        except FileNotFoundError:
            pass

        for path in self.path.iterdir():
            if path.name.startswith("_"):
                continue
            if path.is_file():
                entry = Entry.load(path)
                entry.path = path
                entry.collection = self
                self[path.stem] = entry

        self.persisted = True


def permissions_factory():
    return {"*": {"*": Permissions.NONE}}


@dataclass
class Entry:
    collection: Collection
    path: Path
    data: Dict[str, Any] = field(default_factory=dict)
    permissions: Dict[str, Dict[str, Permissions]] = field(default_factory=permissions_factory)
    counters: Counter = field(default_factory=Counter)
    persisted: bool = False

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
        self.collection.database.persisted = False
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
    def load(path: Path) -> Entry:
        with open(path, "rb") as f:
            return pickle.load(f)


db = Database()
db.load()
