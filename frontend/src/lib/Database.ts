import * as Events from "../lib/Events.ts";
import { Character, User } from "./Models.ts";
import { ApiRequest, Session, Subscribe } from "./Requests.ts";
import { Bound, ApplyChanges, ResolvePath, IsDefined } from "./Utils.ts";
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
            Events.dispatch("userCreate", update.user);
        }
        else if (update.type == "delete") {
            delete users[update.id];
            Events.dispatch("userDelete", update.id);
        }
        else if (update.type == "update") {
            users[update.user.id] = update.user;
            Events.dispatch("userUpdate", update.user);
        }
        else if (update.type == "connect") {
            users[update.id].online = true;
            Events.dispatch("userPresence", update.id, true);
        }
        else if (update.type == "disconnect") {
            users[update.id].online = false;
            Events.dispatch("userPresence", update.id, false);
        }
    });
}


export function GetSetting(path: string, defaultValue = undefined): string | boolean | number | null {
    const result = ResolvePath(users[Session.id].settings, path);
    if (IsDefined(result)) {
        return result;
    }
    else if (IsDefined(defaultValue)) {
        return defaultValue;
    }
    else {
        return null;
    }
}

export function ChangeSetting(path: string, value: string | boolean | number) {
    ApiRequest("/user/settings", { changes: { [path]: value } });

    Events.dispatch("settings", path, value);

    let prefix = "settings";
    for (const component of path.split(".")) {
        prefix += "." + component;
        Events.dispatch(prefix, path, value);
    }
}


export async function ResolveCharacter(id: string): Promise<Character> {
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

    return response.character;
}


export async function TrackCharacter(id: string): Promise<Character> {
    characters[id] = await ResolveCharacter(id);

    await Subscribe(id, update => {
        if (update.type == "update") {
            ApplyChanges(characters[id], update.changes, (operator, key, value) => {
                if (operator == "set") {
                    Events.dispatch(`${id}.${key}`, value);
                }
            });
        }
        if (update.type == "delete") {
            delete characters[id];
        }
    });

    return characters[id];
}


export async function GetSpeaker() {
    const user = users[Session.id];
    if (user.character_id) {
        try {
            return await TrackCharacter(user.character_id);
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
            return await TrackCharacter(user.character_id);
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
        character = await TrackCharacter(users[Session.id].character_id);
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
        character = await TrackCharacter(users[Session.id].character_id);
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
