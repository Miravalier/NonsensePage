from __future__ import annotations

import json
import re
import secrets
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import strawberry
from strawberry.types import Info

import files
import updates
import utilities
from db import DBEntry, db
from db_models import DBChat, DBMessage, DBUser
from enums import Permissions
from graphql_models import Character, Chat, File, Message, MessageUpdate, User
from graphql_utilities import IsAuthenticated, IsGM, db_to_graphql, get_user_from_context
from security import check_password, hash_password

directory_regex = re.compile(r"/([_a-zA-Z0-9]+/)*")
filename_regex = re.compile(r"(.[a-zA-Z0-9]+)?")


@strawberry.type
class Query:
    @strawberry.field(permission_classes=[IsAuthenticated])
    def files(self, info: Info, path: str) -> List[File]:
        if not directory_regex.fullmatch(path):
            raise ValueError("Invalid path")
        path: Path = Path("/files" + path)
        if not path.is_dir():
            raise TypeError("Invalid path, not a directory")
        results = []
        for result in path.iterdir():
            # Strip off the "/files" prefix
            result_path = "/" + "/".join(result.parts[2:])
            # Ensure directories end in "/"
            if result.is_dir():
                result_path += "/"
            results.append(File(result_path, files.sniff(result)))
        return results

    @strawberry.field(permission_classes=[IsAuthenticated])
    def chat(self, info: Info, id: str) -> Chat:
        if id == "current":
            entry = db.chats.index_get("tag", "current")
            if entry is None:
                id = utilities.random_id()
                db.chats.add(DBChat(id=id, message_ids=[]))
                db.chats.index_set("tag", "current", id)
                entry = db.chats[id]
        else:
            entry = db.chats[id]
        if entry is None:
            raise ValueError(f"invalid chat id '{id}'")
        return entry.as_schema(Chat, info)

    @strawberry.field(permission_classes=[IsAuthenticated])
    def user(self, info: Info, id: Optional[str] = None) -> User:
        if id is None:
            user = get_user_from_context(info.context)
            return User(user.id, user.name, user.is_gm, user.character_id)
        else:
            return db_to_graphql(db.users[id], User, info)


@strawberry.type
class Mutation:
    @strawberry.mutation
    def login(self, info: Info, username: str, password: str) -> str:
        # Find the requested user by username
        user_entry = db.users.index_get("username", username)
        if user_entry is None:
            raise Exception("invalid username or password")

        # Convert the db entry to a User model
        user = DBUser.parse_obj(user_entry.data)

        # Check the password
        if not check_password(password, user.hashed_password):
            raise Exception("invalid username or password")

        # Generate a token and create a session
        token = secrets.token_hex(16)
        db.users.index_set("token", token, user.id)
        return token

    @strawberry.mutation(permission_classes=[IsGM])
    def register_user(self, info: Info, username: str, password: str) -> User:
        id = utilities.random_id()
        db.users.add(
            {
                "id": id,
                "name": username,
                "hashed_password": hash_password(password),
                "is_gm": False,
            }
        )
        db.users.index_set("username", username, id)
        return User(id, username, False)

    @strawberry.mutation(permission_classes=[IsGM])
    def delete_user(self, info: Info, id: str) -> bool:
        if id not in db.users:
            raise Exception("user does not exist")
        user = get_user_from_context(info.context)
        if id == user.id:
            raise Exception("you can't delete your own account")
        db.users.delete(id)
        return True

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    def send_message(
        self,
        info: Info,
        chat_id: str,
        language: str,
        content: str,
        speaker_id: str,
        speaker_name: str,
    ) -> Message:
        user = get_user_from_context(info.context)
        if speaker_id:
            speaker = db.characters[speaker_id]
            if speaker is None:
                raise Exception("Invalid speaker id")
            if not speaker.has_permission(user.id, "speak", Permissions.OWNER):
                raise Exception("Insufficient permissions to speak as that character")
        if chat_id == "current":
            chat = db.chats.index_get("tag", "current")
            if chat is None:
                chat_id = utilities.random_id()
                db.chats.add(DBChat(id=chat_id, message_ids=[]))
                db.chats.index_set("tag", "current", chat_id)
                chat = db.chats[chat_id]
        else:
            chat = db.chats[chat_id]
        if chat is None:
            raise Exception("Invalid chat id")
        message_id = utilities.random_id()
        timestamp = datetime.now()
        db.messages.add(
            DBMessage(
                id=message_id,
                timestamp=timestamp,
                language=language,
                content=content,
                sender_id=user.id,
                speaker_id=speaker_id,
                speaker_name=speaker_name,
            )
        )
        message_ids: List[str] = chat.data["message_ids"]
        message_ids.append(message_id)
        chat.update({"message_ids": message_ids})
        message = Message(message_id, timestamp, language, content, user.id, speaker_id, speaker_name)
        updates.messages.publish(MessageUpdate(chat.id, message))
        return message


@strawberry.type
class Subscription:
    @strawberry.subscription()
    async def messages(self, info: Info) -> MessageUpdate:
        user = get_user_from_context(info.context)
        if user is None:
            raise Exception("Unauthenticated websocket user.")
        with updates.messages.subscribe() as queue:
            while True:
                update: MessageUpdate = await queue.get()
                queue.task_done()

                character = db_to_graphql(db.characters[user.character_id], Character, info)
                if not user.is_gm and update.message.language in character.languages:
                    update.message = Message(
                        update.message.id,
                        update.message.timestamp,
                        update.message.language,
                        "Lorem ipsum.",
                        update.message.sender_id,
                        update.message.speaker_id,
                        update.message.speaker_name,
                    )

                yield update

    @strawberry.subscription
    async def general(self, info: Info) -> str:
        user = get_user_from_context(info.context)
        with updates.general.subscribe() as queue:
            while True:
                # Wait for an entry in the queue
                entry: DBEntry = await queue.get()
                queue.task_done()
                # Publish any fields that the user has access to
                update = {"collection": entry.collection.name, "id": entry.id}
                for key, field in entry.data.items():
                    if entry.has_permission(user.id, key, Permissions.READ):
                        update[key] = field
                yield json.dumps(update)


schema = strawberry.Schema(Query, Mutation, Subscription)
