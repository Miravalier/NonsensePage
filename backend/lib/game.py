from fastapi.encoders import jsonable_encoder

from ..lib import database
from ..lib.utils import current_timestamp
from ..models.database_models import User, Language, Message, get_pool


async def send_message(content: str, *, user: User, speaker: str = "System", character_id: str = None, language = Language.COMMON):
    # Create message
    message: Message = database.messages.create({
        "sender_id": user.id,
        "character_id": character_id,
        "speaker": speaker,
        "content": content.strip(),
        "language": language,
        "timestamp": current_timestamp(),
    })
    # Inform subscribers
    full_broadcast = jsonable_encoder(message.model_dump())
    full_broadcast["type"] = "send"
    full_broadcast["pool"] = "messages"
    foreign_broadcast = jsonable_encoder(message.foreign_dict())
    foreign_broadcast["type"] = "send"
    foreign_broadcast["pool"] = "messages"
    for connection in get_pool("messages"):
        if language == Language.COMMON or language in connection.user.languages:
            await connection.send(full_broadcast)
        else:
            await connection.send(foreign_broadcast)
    return message
