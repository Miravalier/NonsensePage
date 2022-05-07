from __future__ import annotations

from dataclasses import dataclass, field
from fastapi import WebSocket
from typing import Dict, Iterator, Set, Any

from database import User


@dataclass
class Connection:
    user: User
    websocket: WebSocket
    pools: Set[Pool] = field(default_factory=set)

    async def send(self, jsonable):
        await self.websocket.send_json(jsonable)

    def __hash__(self):
        return hash(id(self))


class Pool:
    def __init__(self):
        self.connections: Set[Connection] = set()

    def add(self, connection: Connection):
        self.connections.add(connection)

    def discard(self, connection: Connection):
        self.connections.discard(connection)

    async def broadcast(self, obj: Dict[str, Any]):
        for connection in self.connections:
            await connection.send(obj)

    def __iter__(self) -> Iterator[Connection]:
        return iter(self.connections)

    def __hash__(self):
        return hash(id(self))
