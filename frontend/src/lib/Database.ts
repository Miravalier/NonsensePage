import { ApiRequest, Subscribe } from "./Requests.ts";

export const users = {};


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
            users[update.user.id] = update.user;
        }
    });
}
