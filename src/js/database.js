import { ApiRequest, Subscribe } from "./requests.js";

export const users = {};


async function resolveCharacter(user) {
    user.character = null;
    if (!user.character_id) {
        return;
    }
    const characterGetResponse = await ApiRequest("/character/get", { id: user.character_id });
    const character = characterGetResponse.character;
    user.character = character;
    if (!user.characterSubscription) {
        user.characterSubscription = await Subscribe(character.id, update => {
            resolveCharacter(user);
        });
    }
}


export async function init() {
    const userListResponse = await ApiRequest("/user/list");
    for (let user of userListResponse.users) {
        resolveCharacter(user);
        users[user.id] = user;
    }
    await Subscribe("users", update => {
        if (update.type == "create") {
            resolveCharacter(update.user);
            users[update.user.id] = update.user;
        }
        else if (update.type == "delete") {
            const user = users[update.id];
            if (user.characterSubscription) {
                user.characterSubscription.cancel();
                user.characterSubscription = null;
            }
            delete users[update.id];
        }
        else if (update.type == "update") {
            const user = users[update.user.id];
            if (user.characterSubscription) {
                user.characterSubscription.cancel();
                user.characterSubscription = null;
            }
            resolveCharacter(update.user);
            users[update.user.id] = update.user;
        }
    });
}
