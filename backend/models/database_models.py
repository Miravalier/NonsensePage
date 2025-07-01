from __future__ import annotations

import shapely
from dataclasses import dataclass, field
from datetime import datetime
from fastapi import WebSocket
from fastapi.encoders import jsonable_encoder
from pathlib import Path
from pydantic import BaseModel, Field, GetCoreSchemaHandler, GetJsonSchemaHandler
from pydantic_core import core_schema
from pydantic.functional_serializers import PlainSerializer
from pydantic.functional_validators import BeforeValidator
from pydantic.json_schema import JsonSchemaValue
from typing import Annotated, Any, Iterator, Optional, Union, Sequence

from ..lib.enums import (
    Alignment, Language, Permissions,
    Layer, GridColor, AbilityType,
    ScaleType
)
from ..lib.utils import current_timestamp
from ..lib.presence import connected_users


FILES_ROOT = Path("/files")


def polygon_to_coordinates(shape: shapely.Polygon) -> Sequence[tuple[int, int]]:
    return shapely.geometry.mapping(shape)["coordinates"][0]


def coordinates_to_polygon(coordinates: Sequence[tuple[int, int]]) -> shapely.Polygon:
    return shapely.Polygon(coordinates)


class _PolygonAnnotation:
    @classmethod
    def __get_pydantic_core_schema__(cls, _source_type: Any, _handler: GetCoreSchemaHandler) -> core_schema.CoreSchema:
        from_list_schema = core_schema.chain_schema([
            core_schema.list_schema(core_schema.tuple_schema([
                core_schema.float_schema(),
                core_schema.float_schema(),
            ])),
            core_schema.no_info_plain_validator_function(coordinates_to_polygon),
        ])

        return core_schema.json_or_python_schema(
            json_schema=from_list_schema,
            python_schema=core_schema.union_schema([
                core_schema.is_instance_schema(shapely.Polygon),
                from_list_schema,
            ]),
            serialization=core_schema.plain_serializer_function_ser_schema(polygon_to_coordinates),
        )

    @classmethod
    def __get_pydantic_json_schema__(cls, _core_schema: core_schema.CoreSchema, handler: GetJsonSchemaHandler) -> JsonSchemaValue:
        return handler(core_schema.list_schema(core_schema.tuple_schema([
            core_schema.float_schema(),
            core_schema.float_schema(),
        ])))


Polygon = Annotated[
    shapely.Polygon,
    _PolygonAnnotation,
]


class _GeometryAnnotation:
    @classmethod
    def __get_pydantic_core_schema__(cls, _source_type: Any, _handler: GetCoreSchemaHandler) -> core_schema.CoreSchema:
        from_dict_schema = core_schema.chain_schema([
            core_schema.dict_schema(
                keys_schema=core_schema.str_schema(),
                values_schema=core_schema.any_schema(),
            ),
            core_schema.no_info_plain_validator_function(shapely.geometry.shape),
        ])

        return core_schema.json_or_python_schema(
            json_schema=from_dict_schema,
            python_schema=core_schema.union_schema([
                core_schema.is_instance_schema(shapely.geometry.base.BaseGeometry),
                from_dict_schema,
            ]),
            serialization=core_schema.plain_serializer_function_ser_schema(shapely.geometry.mapping),
        )

    @classmethod
    def __get_pydantic_json_schema__(cls, _core_schema: core_schema.CoreSchema, handler: GetJsonSchemaHandler) -> JsonSchemaValue:
        return handler(core_schema.dict_schema(
            keys_schema=core_schema.str_schema(),
            values_schema=core_schema.any_schema(),
        ))


Geometry = Annotated[
    shapely.geometry.base.BaseGeometry,
    _GeometryAnnotation,
]


@dataclass
class Connection:
    user: User
    websocket: WebSocket
    pools: set[Pool] = field(default_factory=set)

    async def send(self, jsonable):
        await self.websocket.send_json(jsonable)

    def __hash__(self):
        return hash(id(self))


class Pool:
    def __init__(self, name: str):
        self.connections: set[Connection] = set()
        self.name = name

    def add(self, connection: Connection):
        self.connections.add(connection)

    def discard(self, connection: Connection):
        self.connections.discard(connection)

    async def broadcast(self, obj: dict[str, Any]):
        obj["pool"] = self.name
        for connection in self.connections:
            await connection.send(obj)

    def __iter__(self) -> Iterator[Connection]:
        return iter(self.connections)

    def __hash__(self):
        return hash(id(self))


MESSAGE_POOL = Pool("messages")
EVENT_POOLS: dict[str, Pool] = {}


def get_pool(request: Union[str, dict[str, Any]]):
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


class Roll(BaseModel):
    type: str
    label: str
    formula: str


class CharacterAbility(BaseModel):
    id: str
    name: str = ""
    image: str = ""
    description: str = ""
    type: AbilityType = AbilityType.PASSIVE
    cooldown: int = 0
    rolls: list[Roll] = Field(default_factory=list)


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
    id: str = None
    name: Optional[str] = None
    permissions: dict[str, dict[str, Permissions]] = Field(default_factory=new_permissions)
    data: dict = Field(default_factory=dict)
    image: str = ""

    def __hash__(self):
        return hash(self.id)

    @property
    def pool(self):
        return get_pool(self.id)

    async def broadcast_changes(self, changes: dict):
        await self.pool.broadcast(jsonable_encoder({
            "type": "update",
            "changes": changes,
        }))

    def add_permission(self, id: str = "*", field: str = "*", level: Permissions = Permissions.READ):
        """
        Add the given level of permission to this document, if the existing level is not higher.
        """
        sub_permissions = self.permissions.get(id, None)
        if sub_permissions is None:
            sub_permissions = {}
            self.permissions[id] = sub_permissions
        sub_permissions[field] = max(sub_permissions.get(field, Permissions.INHERIT), level)

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
        """
        Check if the given ID has at least the given level of permission for the given field.
        """
        return self.get_permission(id, field) >= level


class Entity(Entry):
    stat_map: dict[str, Stat] = Field(default_factory=dict)
    stat_order: list[str] = Field(default_factory=list)

    @property
    def stats(self):
        for stat_id in self.stat_order:
            yield self.stat_map[stat_id]


class Container(Entry):
    item_map: dict[str, Item] = Field(default_factory=dict)
    item_order: list[str] = Field(default_factory=list)

    @property
    def items(self):
        for item_id in self.item_order:
            yield self.item_map[item_id]


class Item(Entity, Container):
    entry_type: str = "item"
    description: str = ""


class Folder(Entry):
    entry_type: str = "folder"
    parent_id: Optional[str] = None
    alternate_id: Optional[str] = None


class Character(Entity, Container):
    entry_type: str = "character"
    folder_id: Optional[str] = None
    description: str = ""
    alignment: Alignment = Alignment.NEUTRAL
    hp: float = 0
    max_hp: float = 0
    temp_hp: float = 0
    size: float = 1
    scale: float = 1.0
    actions: int = 0
    max_actions: int = 1
    reactions: int = 0
    max_reactions: int = 2
    sheet_type: str = "default"
    ability_map: dict[str, CharacterAbility] = Field(default_factory=dict)
    ability_order: list[str] = Field(default_factory=list)


class Ability(Entry):
    entry_type: str = "ability"
    folder_id: Optional[str] = None
    sheet_type: str = "default"
    description: str = ""
    type: AbilityType = AbilityType.PASSIVE
    cooldown: int = 0
    rolls: list[Roll] = Field(default_factory=list)


class Note(Entry):
    entry_type: str = "note"
    folder_id: Optional[str] = None
    text: str = ""


class User(Entry):
    entry_type: str = "user"
    hashed_password: bytes = Field(exclude=True, default=b"")
    is_gm: bool = False
    character_id: Optional[str] = None
    languages: list[Language] = Field(default_factory=list)
    settings: dict = Field(default_factory=dict)
    active: bool = True

    @property
    def file_root(self) -> Path:
        if self.is_gm:
            return FILES_ROOT
        else:
            return FILES_ROOT / "users" / self.name

    def model_dump(self, *args, **kwargs) -> dict[str, Any]:
        result = super().model_dump(*args, **kwargs)
        result["online"] = self.id in connected_users
        return result


class Combatant(Entry):
    entry_type: str = "combatant"
    character_id: Optional[str] = None
    initiative: Optional[float] = None


class Combat(Entry):
    entry_type: str = "combat"
    combatants: list[Combatant] = Field(default_factory=list)


class Token(Entry):
    entry_type: str = "token"
    layer: Layer = Layer.CHARACTERS
    src: str = ""
    x: float = 0.0
    y: float = 0.0
    z: int = 0
    hitbox_width: float = None
    hitbox_height: float = None
    width: float = None
    height: float = None
    scale_type: ScaleType = ScaleType.RELATIVE
    rotation: float = 0.0
    character_id: str = None


class Map(Entry):
    entry_type: str = "map"
    tokens: dict[str, Token] = Field(default_factory=dict)
    revealed_areas: Optional[Geometry] = None
    squareSize: int = 150
    gridColor: GridColor = GridColor.WHITE
    backgroundColor: int = "000000"


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

    def foreign_dict(self) -> dict[str, Any]:
        result = self.model_dump(exclude={"content": True})
        result["length"] = len(self.content)
        return result
