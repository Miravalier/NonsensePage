import { ApiRequest } from "./requests.js";


const CHARACTER_UPDATES: {
    [id: string]: {
        expiration: number,
        changes: any,
    }
} = {};


export async function CheckUpdates() {
    // Get the current time once
    const now = Date.now()

    // Check pending character updates
    for (const [id, update] of Object.entries(CHARACTER_UPDATES)) {
        if (now > update.expiration) {
            delete CHARACTER_UPDATES[id];
            await ApiRequest("/character/update", { id: id, changes: { "$set": update.changes } });
        }
    }
}


export function AddCharacterUpdate(id: string, changes: any) {
    let update = CHARACTER_UPDATES[id];
    if (update) {
        update.expiration = Date.now() + 500;
    }
    else {
        update = {
            expiration: Date.now() + 250,
            changes: {}
        };
        CHARACTER_UPDATES[id] = update;
    }
    Object.assign(update.changes, changes);
}
