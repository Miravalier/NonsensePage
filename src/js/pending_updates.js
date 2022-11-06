import { ApiRequest } from "./requests.js";


const CHARACTER_UPDATES = {}


export async function CheckUpdates() {
    // Get the current time once
    const now = Date.now()

    // Check pending character updates
    for (const [key, update] of Object.entries(CHARACTER_UPDATES)) {
        if (now > update.expiration) {
            delete CHARACTER_UPDATES[key];
            await ApiRequest("/character/update", update.data);
        }
    }
}


export function AddCharacterUpdate(data) {
    let update = CHARACTER_UPDATES[data.id];
    if (update) {
        update.expiration = Date.now() + 500;
    }
    else {
        update = {
            expiration: Date.now() + 250,
            data: {}
        };
        CHARACTER_UPDATES[data.id] = update;
    }
    Object.assign(update.data, data);
}
