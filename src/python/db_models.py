from __future__ import annotations

from datetime import datetime
from typing import List

from enums import Alignment
from pydantic import BaseModel


class DBMessage(BaseModel):
    id: str
    timestamp: datetime
    language: str
    content: str
    sender_id: str
    speaker_id: str
    speaker_name: str


class DBChat(BaseModel):
    id: str
    message_ids: List[str]


class DBCharacter(BaseModel):
    id: str
    name: str
    alignment: Alignment
    owner_id: str
    languages: List[str]


class DBUser(BaseModel):
    id: str
    name: str
    hashed_password: bytes
    is_gm: bool = False
    character_id: str = ""
