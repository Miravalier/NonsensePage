import secrets
import random
from fastapi import APIRouter
from typing import Optional

from ..lib import database
from ..lib.errors import JsonError
from ..lib.game import send_message
from ..lib.utils import require, auth_require
from ..models.database_models import Combat, Permissions
from ..models.request_models import AuthRequest, GMRequest


router = APIRouter()


class NewCombatRequest(GMRequest):
    name: str


@router.post("/create")
async def combat_new(request: NewCombatRequest):
    combat: Combat = database.combats.create({"name": request.name})
    return {
        "status": "success",
        "combat": combat.model_dump()
    }


class GetCombatRequest(AuthRequest):
    id: str


@router.post("/get")
async def combat_get(request: GetCombatRequest):
    combat = database.combats.find_one(request.id)

    if combat is None:
        raise JsonError("invalid combat id")

    return {
        "status": "success",
        "combat": combat.model_dump(),
    }


class CombatUpdateRequest(AuthRequest):
    id: str
    changes: dict


@router.post("/update")
async def combat_update(request: CombatUpdateRequest):
    combat = require(database.combats.find_one(request.id), "invalid combat id")
    if not request.requester.is_gm:
        auth_require(combat.has_permission(request.requester.id, "*", Permissions.WRITE))

    database.combats.find_one_and_update(request.id, request.changes)

    await combat.broadcast_changes(request.changes)
    return {"status": "success"}


class CombatSortRequest(AuthRequest):
    id: str


@router.post("/sort")
async def combat_sort(request: CombatSortRequest):
    combat = require(database.combats.find_one(request.id), "invalid combat id")
    require(len(combat.combatants) > 0, "not enough combatants")
    if not request.requester.is_gm:
        auth_require(combat.has_permission(request.requester.id, "*", Permissions.WRITE))

    combatants = combat.combatants
    combatants.sort(key=lambda c: c.initiative if c.initiative else 0, reverse=True)

    update = {"$set": {
        "combatants": [c.model_dump() for c in combatants],
    }}

    database.combats.find_one_and_update(request.id, update)
    await combat.broadcast_changes(update)

    return {"status": "success"}


class CombatShuffleRequest(AuthRequest):
    id: str


@router.post("/shuffle")
async def combat_sort(request: CombatShuffleRequest):
    combat = require(database.combats.find_one(request.id), "invalid combat id")
    require(len(combat.combatants) > 0, "not enough combatants")
    if not request.requester.is_gm:
        auth_require(combat.has_permission(request.requester.id, "*", Permissions.WRITE))

    combatants = list(combat.combatants)
    random.shuffle(combatants)

    update = {"$set": {
        "combatants": [c.model_dump() for c in combatants],
    }}

    database.combats.find_one_and_update(request.id, update)
    await combat.broadcast_changes(update)

    return {"status": "success"}


class CombatClearRequest(AuthRequest):
    id: str


@router.post("/clear")
async def combat_clear(request: CombatClearRequest):
    combat = require(database.combats.find_one(request.id), "invalid combat id")
    require(len(combat.combatants) > 0, "not enough combatants")
    if not request.requester.is_gm:
        auth_require(combat.has_permission(request.requester.id, "*", Permissions.WRITE))

    update = {"$set": {
        "combatants": [],
    }}

    database.combats.find_one_and_update(request.id, update)
    await combat.broadcast_changes(update)

    return {"status": "success"}


class AnnounceTurnRequest(AuthRequest):
    id: str


@router.post("/announce-turn")
async def combat_announce_turn(request: AnnounceTurnRequest):
    combat = require(database.combats.find_one(request.id), "invalid combat id")
    auth_require(request.requester.is_gm)
    require(len(combat.combatants) > 0, "not enough combatants")
    combatant = combat.combatants[0]
    await send_message(
        f'<div class="turn-start">Turn Start: {combatant.name}</div>',
        user=request.requester,
    )
    return {"status": "success"}


class ReverseTurnRequest(AuthRequest):
    id: str


@router.post("/reverse-turn")
async def combat_end_turn(request: ReverseTurnRequest):
    combat = require(database.combats.find_one(request.id), "invalid combat id")
    auth_require(request.requester.is_gm)
    require(len(combat.combatants) > 1, "not enough combatants")
    combatant = combat.combatants[-1]

    database.combats.find_one_and_update(request.id, {
        "$pull": {
            "combatants": {
                "id": combatant.id,
            },
        },
    })
    database.combats.find_one_and_update(request.id, {
        "$push": {
            "combatants": {
                "$each": [combatant.model_dump()],
                "$position": 0,
            }
        }
    })

    await combat.pool.broadcast({"type": "reverse-turn", "id": combatant.id})
    await send_message(
        f'<div class="turn-start">Turn Start: {combatant.name}</div>',
        user=request.requester,
    )
    return {"status": "success"}


class EndTurnRequest(AuthRequest):
    id: str


@router.post("/end-turn")
async def combat_end_turn(request: EndTurnRequest):
    combat = require(database.combats.find_one(request.id), "invalid combat id")
    require(len(combat.combatants) >= 1, "not enough combatants")
    combatant = combat.combatants[0]
    character = database.characters.find_one(combatant.character_id)
    if not request.requester.is_gm:
        if character is not None:
            auth_require(
                combat.has_permission(request.requester.id, "*", Permissions.WRITE)
                or
                character.has_permission(request.requester.id, "*", Permissions.OWNER)
            )
        else:
            auth_require(combat.has_permission(request.requester.id, "*", Permissions.WRITE))

    combat = database.combats.find_one_and_update(request.id, {
        "$pull": {
            "combatants": {
                "id": combatant.id,
            },
        },
    })
    combat = database.combats.find_one_and_update(request.id, {
        "$push": {
            "combatants": combatant.model_dump()
        }
    })

    next_combatant = combat.combatants[0]
    next_character = database.characters.find_one(next_combatant.character_id)

    await combat.pool.broadcast({"type": "end-turn", "id": combatant.id})

    await send_message(
        f'<div class="turn-start">Turn Start: {combat.combatants[0].name}</div>',
        user=request.requester,
    )

    if next_character:
        changes = {"$set": {
            "actions": next_character.max_actions,
            "reactions": next_character.max_reactions,
        }}
        database.characters.find_one_and_update(next_character.id, changes)
        await next_character.broadcast_changes(changes)

    return {"status": "success"}


@router.post("/list")
async def combat_list(request: AuthRequest):
    return {
        "status": "success",
        "combats": [
            combat.model_dump()
            for combat in database.combats.find()
        ],
    }


class AddCombatantRequest(AuthRequest):
    combat_id: Optional[str] = None
    character_id: Optional[str] = None
    name: Optional[str] = None



@router.post("/add-combatant")
async def add_combatant(request: AddCombatantRequest):
    if request.combat_id is None:
        combat = require(database.combats.find_one({}), "no combat")
    else:
        combat = require(database.combats.find_one(request.combat_id), "invalid combat id")

    auth_require(
        request.requester.is_gm
        or
        combat.has_permission(request.requester.id, "*", Permissions.WRITE)
    )

    require(request.character_id is not None or request.name is not None, "name or character_id is required")
    combatant_id = secrets.token_hex(12)
    combatant = {"id": combatant_id}

    if request.character_id is not None:
        character = require(database.characters.find_one(request.character_id), "invalid character id")
        combatant["name"] = character.name
        combatant["permissions"] = character.permissions
        combatant["character_id"] = character.id
        combatant["image"] = character.image

    if request.name is not None:
        combatant["name"] = request.name

    update = {
        "$push": {
            "combatants": combatant
        }
    }
    database.combats.find_one_and_update(combat.id, update)
    await combat.broadcast_changes(update)
    return {"status": "success", "id": combatant_id}
