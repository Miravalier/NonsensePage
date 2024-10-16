import { Character, User } from "./Models.ts";
import { ApiRequest, Session, Subscribe } from "./Requests.ts";
import { Bound, ApplyChanges } from "./Utils.ts";
import { ErrorToast } from "./Notifications.ts";
import { Sleep } from "./Async.ts";

export const users: { [id: string]: User } = {};
export const characters: { [id: string]: Character } = {};


export async function init() {
    const userListResponse = await ApiRequest("/user/list");
    for (let user of userListResponse.users) {
        users[user.id] = user;
    }
    await Subscribe("users", update => {
        if (update.type == "create") {
            users[update.user.id] = update.user;
        }
        else if (update.type == "delete") {
            delete users[update.id];
        }
        else if (update.type == "update") {
            users[update.user.id] = update.user;
        }
    });
}


export async function ResolveCharacter(id: string, cache: boolean = undefined): Promise<Character> {
    if (id === null || typeof id === "undefined") {
        throw Error("null or undefined character id");
    }
    const cachedCharacter = characters[id];
    if (cachedCharacter) {
        return cachedCharacter;
    }

    const response: {
        status: string;
        reason: string;
        character: Character;
    } = await ApiRequest("/character/get", { id });
    if (response.status !== "success") {
        throw Error(response.reason);
    }

    if (cache) {
        characters[id] = response.character;
        await Subscribe(id, update => {
            if (update.type == "update") {
                ApplyChanges(characters[id], update.changes);
            }
            if (update.type == "delete") {
                delete characters[id];
            }
        });
    }

    return response.character;
}


export async function GetSpeaker() {
    const user = users[Session.id];
    if (user.character_id) {
        try {
            return await ResolveCharacter(user.character_id, true);
        } catch {
            return user;
        }
    }
    else {
        return user;
    }
}


export async function GetCharacter() {
    const user = users[Session.id];
    if (user.character_id) {
        try {
            return await ResolveCharacter(user.character_id, true);
        } catch {
            return null;
        }
    }
    else {
        return null;
    }
}


export async function ApplyShield(amount: number) {
    let character: Character = null;
    try {
        character = await ResolveCharacter(users[Session.id].character_id);
    } catch {
        ErrorToast("You are not controlling a character.");
        return;
    }

    await ApiRequest("/character/update", {
        id: character.id,
        changes: {
            "$set": {
                "temp_hp": Math.max(character.temp_hp, amount),
            }
        },
    });

    const notifications = document.getElementById("notifications") as HTMLDivElement;
    notifications.classList.add("shielded");
    await Sleep(500);
    notifications.classList.remove("shielded");
}


export async function ApplyHealing(amount: number) {
    if (amount <= 0) {
        return;
    }
    await ApplyDamage(-amount);
}


export async function ApplyDamage(amount: number) {
    let character: Character = null;
    try {
        character = await ResolveCharacter(users[Session.id].character_id);
    } catch {
        ErrorToast("You are not controlling a character.");
        return;
    }

    let style: string = null;
    const updates = {};
    if (amount < 0) {
        updates["hp"] = Bound(0, character.hp - amount, character.max_hp);
        style = "healing";
    }
    else if (amount <= character.temp_hp) {
        style = "shielded";
        updates["temp_hp"] = character.temp_hp - amount;
    }
    else {
        style = "damage";
        updates["temp_hp"] = 0;
        amount -= character.temp_hp
        updates["hp"] = Bound(0, character.hp - amount, character.max_hp);
    }

    await ApiRequest("/character/update", {
        id: character.id,
        changes: { "$set": updates },
    });

    if (style) {
        const notifications = document.getElementById("notifications") as HTMLDivElement;
        notifications.classList.add(style);
        await Sleep(500);
        notifications.classList.remove(style);
    }
}
