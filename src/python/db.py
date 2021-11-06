from __future__ import annotations

import pickle
import secrets
from pathlib import Path
from typing import Dict, Sequence, Tuple, Union

from crc import crc32c
from permissions import Permissions


def process_update(data: Dict, update: Dict, crc: int = 0) -> Tuple[Dict, int]:
    for key, value in update.items():
        if isinstance(value, dict):
            data[key], crc = process_update(data.get(key, {}), value, crc)
        else:
            data[key] = value
            crc = crc32c(crc, key)
            crc = crc32c(crc, str(value))
    return data, crc


class Database:
    def __init__(self, path: str, parent: Database = None):
        self.path = Path(path)
        self.parent = parent
        self.children: Dict[str, Union[Database, DatabaseEntry]] = {}
        self.tag = secrets.randbits(64)
        self.persisted = False

    def __iter__(self):
        return (child for child in self.children.values() if isinstance(child, DatabaseEntry))

    def save(self):
        if self.persisted:
            return

        self.path.mkdir(parents=True, exist_ok=True)
        for link, child in self.children.items():
            if isinstance(child, Database):
                child.save()
            elif isinstance(child, DatabaseEntry):
                with open(self.path / link, "wb") as f:
                    pickle.dump(child.data, f)
                child.persisted = True

        self.persisted = True

    def load(self):
        self.path.mkdir(parents=True, exist_ok=True)
        self.persisted = True
        for path in self.path.iterdir():
            if path.is_dir:
                child = Database(path, self)
                self.children[path.stem] = child
                child.load()
            else:
                with open(path, "rb") as f:
                    data = pickle.load(f)
                child = DatabaseEntry(self, secrets.randbits(64), data)
                child.persisted = True
                self.children[path.stem] = child

    def resolve_path(
        self, path: Union[str, Sequence[str]], create: bool = False
    ) -> Union[None, Database, DatabaseEntry]:
        # Accept either a / delimited str, or a sequence of str as a path
        if isinstance(path, str):
            path = [link for link in path.split("/") if link]
        endpoint = path.pop()
        # Navigate to the leaf's parent directory
        node = self
        for link in path:
            # Skip empty links; starting, ending, and adjacent /'s
            if not link:
                continue
            # Get the next node if it exists
            next_node = node.children.get(link)
            # Entries cannot be found in the middle of a path
            if isinstance(next_node, DatabaseEntry):
                raise TypeError(f"invalid path '{next_node.path}' includes an Entry as a Directory")
            # If the node is doesn't exist, either create it or declare the path invalid
            if next_node is None:
                if create:
                    next_node = Database(node.path / link, self)
                    node.children[link] = next_node
                else:
                    raise TypeError(f"invalid path '{node.path / link}' does not exist")
            node = next_node
        # After resolving path, return the Database or Entry at the end
        result = node.children.get(endpoint)
        if create and result is None:
            result = DatabaseEntry(node)
            node.children[endpoint] = result
        return result

    def __getitem__(self, path: Union[str, Sequence[str]]) -> Union[Database, DatabaseEntry]:
        node = self.resolve_path(path, create=False)
        if isinstance(node, (Database, DatabaseEntry)):
            return node
        else:
            raise KeyError(f"invalid db path '{path}'")

    def __setitem__(self, path: Union[str, Sequence[str]], value: Dict):
        entry: DatabaseEntry = self.resolve_path(path, create=True)
        entry.update(value)


class DatabaseEntry:
    def __init__(self, parent: Database, tag: int = 0, data: Dict = None):
        if data is None:
            data = {}
        self.parent = parent
        self.tag = tag
        self.data = data
        self.persisted = False
        self.permissions = {"*": {"*": Permissions.NONE}}

    def update(self, data: Dict):
        self.data, self.tag = process_update(self.data, data, self.tag)
        self.persisted = False
        node: Union[Database, None] = self.parent
        while node is not None:
            node.tag = self.tag
            node.persisted = False
            node: Union[Database, None] = node.parent


db = Database("/data/db/")
db.load()
