from __future__ import annotations

from datetime import datetime
from typing import List

import strawberry
from strawberry.types.info import Info

from db import DBEntry, db
from db_models import DBChat, DBMessage, DBUser
from enums import Alignment
from graphql_utilities import db_to_graphql, get_user_from_context


@strawberry.type
class File:
    path: str
    type: str


@strawberry.type
class User:
    id: strawberry.ID = ""
    name: str = ""
    is_gm: bool = False
    character_id: str = ""

    @strawberry.field
    def character(self, info: Info) -> Character:
        return db_to_graphql(db.characters[self.character_id], Character, info)

    @staticmethod
    def from_db_entry(entry: DBEntry, info: Info) -> User:
        if entry is None:
            return User()
        db_user = DBUser.parse_obj(entry.data)
        return User(db_user.id, db_user.name, db_user.is_gm, db_user.character_id)


@strawberry.type
class Character:
    id: strawberry.ID = ""
    name: str = ""
    alignment: Alignment = Alignment.NONE
    owner_id: str = ""
    languages: List[str] = strawberry.field(default_factory=list)

    @strawberry.field
    def owner(self, info: Info) -> User:
        return db_to_graphql(db.users[self.owner_id], User, info)


@strawberry.type
class Chat:
    id: strawberry.ID = ""
    messages: List[Message] = strawberry.field(default_factory=[])

    @staticmethod
    def from_db_entry(entry: DBEntry, info: Info) -> User:
        if entry is None:
            return Chat()
        db_chat = DBChat.parse_obj(entry.data)
        return Chat(db_chat.id, [db_to_graphql(db.messages[id], Message, info) for id in db_chat.message_ids])


@strawberry.type
class MessageUpdate:
    chat_id: strawberry.ID
    message: Message


@strawberry.type
class Message:
    id: strawberry.ID = ""
    timestamp: datetime = None
    language: str = ""
    content: str = ""
    sender_id: str = ""
    speaker_id: str = ""
    speaker_name: str = ""

    @staticmethod
    def from_db_entry(entry: DBEntry, info: Info) -> Message:
        if entry is None:
            return Message()
        user = get_user_from_context(info.context)
        db_message = DBMessage.parse_obj(entry.data)
        if user.is_gm or db_message.language in user.character.languages:
            content = db_message.content
        else:
            content = "Lorem ipsum."
        return Message(
            db_message.id,
            db_message.timestamp,
            db_message.language,
            content,
            db_message.sender_id,
            db_message.speaker_id,
            db_message.speaker_name,
        )

    @strawberry.field
    def speaker(self, info: Info) -> Character:
        return db_to_graphql(db.characters[self.speaker_id], Character, info)

    @strawberry.field
    def sender(self, info: Info) -> User:
        return db_to_graphql(db.users[self.sender_id], User, info)
