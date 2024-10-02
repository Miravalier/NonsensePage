import json
from fastapi import APIRouter
from typing import Optional
from pathlib import Path

from ..lib import database, expressions
from ..lib.errors import JsonError
from ..lib.files import validate_path
from ..lib.game import send_message
from ..lib.utils import require, auth_require, current_timestamp
from ..models.database_models import Character, Language, Permissions, get_pool
from ..models.request_models import AuthRequest, GMRequest


router = APIRouter()


class RollRequest(AuthRequest):
    formula: str
    character_id: Optional[str]


@router.post("/roll")
async def send_roll(request: RollRequest):
    response = {"status": "success"}

    character: Optional[Character] = None
    if request.character_id is not None:
        character = require(database.characters.find_one(request.character_id), "character does not exist")

    # Permissions checks
    if not request.requester.is_gm and character is not None:
        auth_require(character.has_permission(request.requester.id, field="speak", level=Permissions.WRITE))

    try:
        result = expressions.evaluate(request.formula, character.data if character else None)
    except Exception as e:
        raise JsonError(f"unrecognized variable '{e}'")

    response["result"] = result
    return response


class SaveMessagesRequest(GMRequest):
    filename: str


@router.post("/save")
async def messages_save(request: SaveMessagesRequest):
    path = validate_path(request.requester, (Path("/chats/") / request.filename).with_suffix(".json"))
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as fp:
        json.dump(
            {
                "timestamp": current_timestamp(),
                "messages": [message.model_dump() for message in database.messages.find()],
            },
            fp
        )

    return {"status": "success"}


@router.post("/clear")
async def messages_clear(request: GMRequest):
    database.messages.delete_many()
    await get_pool("messages").broadcast({"type": "clear"})
    return {"status": "success"}


class SendMessageRequest(AuthRequest):
    speaker: str
    content: str
    character_id: Optional[str] = None
    language: Language = Language.COMMON


@router.post("/speak")
async def messages_speak(request: SendMessageRequest):
    # Permissions checks
    if not request.requester.is_gm:
        if request.character_id is not None:
            character = require(database.characters.find_one(request.character_id), "character does not exist")
            auth_require(character.has_permission(request.requester.id, field="speak", level=Permissions.WRITE))
            auth_require(request.speaker == character.name)
        else:
            auth_require(request.speaker == request.requester.name)
        auth_require(request.language == Language.COMMON or request.language in request.requester.languages)
    # Create message
    message = await send_message(
        request.content,
        user=request.requester,
        character_id=request.character_id,
        speaker=request.speaker,
        language=request.language,
    )
    return {"status": "success", "id": message.id}


@router.post("/recent")
async def recent_messages(request: AuthRequest):
    languages = request.requester.languages
    return {
        "status": "success",
        "messages": [
            (
                message.model_dump()
                if message.language == Language.COMMON or message.language in languages else
                message.foreign_dict()
            )
            for message in database.messages.find()
        ]
    }


class EditMessageRequest(GMRequest):
    id: str
    content: str


@router.post("/edit")
async def edit_message(request: EditMessageRequest):
    database.messages.find_one_and_update(request.id, {"$set": {"content": request.content}})
    await get_pool("messages").broadcast({"type": "edit", "id": request.id, "content": request.content})
    return {"status": "success"}


class DeleteMessageRequest(GMRequest):
    id: str


@router.post("/delete")
async def delete_message(request: DeleteMessageRequest):
    database.messages.delete_one(request.id)
    await get_pool("messages").broadcast({"type": "delete", "id": request.id})
    return {"status": "success"}
