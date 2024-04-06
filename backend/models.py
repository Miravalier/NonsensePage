from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from fastapi import WebSocket
from fastapi.encoders import jsonable_encoder
from pathlib import Path
from pydantic import BaseModel, Field
from typing import Any, Dict, Iterator, List, Optional, Union, Set

from enums import (
    Alignment, Language, Permissions,
    Layer, GridColor, AbilityType
)
from utils import current_timestamp


FILES_ROOT = Path("/files")


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
    def __init__(self, name: str):
        self.connections: Set[Connection] = set()
        self.name = name

    def add(self, connection: Connection):
        self.connections.add(connection)

    def discard(self, connection: Connection):
        self.connections.discard(connection)

    async def broadcast(self, obj: Dict[str, Any]):
        obj["pool"] = self.name
        for connection in self.connections:
            await connection.send(obj)

    def __iter__(self) -> Iterator[Connection]:
        return iter(self.connections)

    def __hash__(self):
        return hash(id(self))


MESSAGE_POOL = Pool("messages")
EVENT_POOLS: Dict[str, Pool] = {}


def get_pool(request: Union[str, Dict[str, Any]]):
    # Get the pool to operate on
    if isinstance(request, str):
        pool_name = request
    else:
        pool_name = request.get("pool")
    pool = EVENT_POOLS.get(pool_name)
    if pool is None:
        pool = Pool(pool_name)
        EVENT_POOLS[pool_name] = pool
    return pool


def new_permissions():
    return {"*": {"*": Permissions.NONE}}


class Ability(BaseModel):
    id: str
    name: str = ""
    description: str = ""
    type: AbilityType = AbilityType.PASSIVE
    cooldown: int = 0


class Stat(BaseModel):
    id: str
    name: str
    value: Union[float, str, bool]
    min: Optional[float] = None
    max: Optional[float] = None


class Session(BaseModel):
    id: str
    auth_token: str
    user_id: str
    last_auth_date: datetime = Field(default_factory=datetime.utcnow)


class Entry(BaseModel):
    id: str
    name: Optional[str] = None
    permissions: Dict[str, Dict[str, Permissions]] = Field(default_factory=new_permissions)
    data: Dict = Field(default_factory=dict)

    def __hash__(self):
        return hash(self.id)

    @property
    def pool(self):
        return get_pool(self.id)

    async def broadcast_changes(self, changes: Dict):
        await self.pool.broadcast(jsonable_encoder({
            "type": "update",
            "changes": changes,
        }))

    def get_permission(self, id: str = "*", field: str = "*") -> Permissions:
        """
        Get the permissions enum for the given ID accessing the given field
        on this entry.
        """
        # Get the permissions associated with the requesting entity
        entity_permissions = self.permissions.get(id, None)
        if entity_permissions is None:
            entity_permissions = self.permissions.get("*", {"*": Permissions.INHERIT})
        # Get the permission associated with the exact field
        field_permission = entity_permissions.get(field, None)
        if field_permission is None:
            field_permission = entity_permissions.get("*", Permissions.INHERIT)
        # Resolve inherited permissions for specific IDs
        if id != "*" and field_permission == Permissions.INHERIT:
            return self.get_permission("*", field)
        return field_permission

    def has_permission(self, id: str = "*", field: str = "*", level: Permissions = Permissions.READ) -> bool:
        return self.get_permission(id, field) >= level


class Entity(Entry):
    stat_map: Dict[str, Stat] = Field(default_factory=dict)
    stat_order: List[str] = Field(default_factory=list)

    @property
    def stats(self):
        for stat_id in self.stat_order:
            yield self.stat_map[stat_id]


class Container(Entry):
    item_map: Dict[str, Item] = Field(default_factory=dict)
    item_order: List[str] = Field(default_factory=list)

    @property
    def items(self):
        for item_id in self.item_order:
            yield self.item_map[item_id]


class Item(Entity, Container):
    type: str = "item"
    description: str = ""


class Character(Entity, Container):
    type: str = "character"
    description: str = ""
    image: str = ""
    alignment: Alignment = Alignment.NEUTRAL
    hp: float = 0
    max_hp: float = 0
    size: float = 1
    scale: float = 1.0
    sheet_type: str = "Lightbearer"
    ability_map: Dict[str, Ability] = Field(default_factory=dict)
    ability_order: List[str] = Field(default_factory=list)


class User(Entry):
    type: str = "user"
    hashed_password: bytes = Field(exclude=True, default=b"")
    is_gm: bool = False
    character_id: Optional[str] = None
    languages: List[Language] = Field(default_factory=list)

    @property
    def file_root(self) -> Path:
        if self.is_gm:
            return FILES_ROOT
        else:
            return FILES_ROOT / "users" / self.name


class Combatant(Entry):
    type: str = "combatant"
    character_id: Optional[str] = None
    initiative: Optional[float] = None


class Combat(Entry):
    type: str = "combat"
    combatants: List[Combatant] = Field(default_factory=list)


class Token(Entry):
    type: str = "token"
    layer: Layer = Layer.CHARACTERS
    src: str = ""
    x: float = 0.0
    y: float = 0.0
    z: int = 0
    width: float = 1.0
    height: float = 1.0
    scale: float = 1.0


class Map(Entry):
    type: str = "map"
    tokens: Dict[str, Token] = Field(default_factory=dict)
    squareSize: int = 150
    color: GridColor = GridColor.WHITE


class Message(BaseModel):
    id: str
    sender_id: str
    character_id: Optional[str]
    timestamp: int = Field(default_factory=current_timestamp)
    language: Language = Language.COMMON
    speaker: str = ""
    content: str = ""
    type: str = "message"

    def __hash__(self):
        return hash(self.id)

    def foreign_dict(self) -> Dict[str, Any]:
        result = self.model_dump(exclude={"content": True})
        result["length"] = len(self.content)
        return result
