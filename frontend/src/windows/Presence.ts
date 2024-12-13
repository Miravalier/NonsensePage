import * as ContextMenu from "../lib/ContextMenu.ts";
import * as Database from "../lib/Database.ts";
import * as Events from "../lib/Events.ts";
import { InvisibleWindow, registerWindowType } from "./Window.ts";
import { Parameter } from "../lib/Utils.ts";
import { User } from "../lib/Models.ts";
import { Html } from "../lib/Elements.ts";
import { ApiRequest, Session } from "../lib/Requests.ts";
import { ErrorToast } from "../lib/Notifications.ts";


export class PresenceWindow extends InvisibleWindow {
    portraits: { [id: string]: HTMLDivElement };

    constructor(options = undefined) {
        options = Parameter(options, {});
        options.classList = ["presence"];
        options.title = Parameter(options.title, "User Presence");
        super(options);
    }

    trackSetting(key: string, defaultValue: boolean) {
        if (Database.GetSetting(`presence.${key}`, defaultValue)) {
            this.content.classList.add(key);
        }
        else {
            this.content.classList.remove(key);
        }
        this.register(`settings.presence.${key}`, (_path: string, value: boolean) => {
            if (value) {
                this.content.classList.add(key);
            }
            else {
                this.content.classList.remove(key);
            }
        });
    }

    async load(_data = undefined) {
        await super.load();
        this.content.innerHTML = "";
        this.portraits = {};

        this.trackSetting("hideImages", true);
        this.trackSetting("hideOffline", true);

        for (const user of Object.values(Database.users)) {
            let image = user.image;
            if (!image) {
                image = "/unknown.png";
            }
            const portrait = this.content.appendChild(Html(`
                <div class="portrait ${user.online ? "online" : ""}">
                    <img src="${image}" draggable=false>
                    <span class="name">${user.name}</span>
                </div>
            `)) as HTMLDivElement;
            portrait.dataset.id = user.id;
            this.portraits[user.id] = portrait;
            if (Session.gm) {
                ContextMenu.set(portrait, {
                    [`User ${user.name}`]: {
                        "Delete": async () => {
                            if (user.is_gm) {
                                ErrorToast("Cannot delete GM - edit the database");
                            }
                            else {
                                await ApiRequest("/user/delete", { id: user.id });
                            }
                        }
                    }
                });
            }
        }

        Events.register("userPresence", (userId: string, online: boolean) => {
            const portrait = this.portraits[userId];
            if (online) {
                portrait.classList.add("online");
            }
            else {
                portrait.classList.remove("online");
            }
        });

        Events.register("userUpdate", (user: User) => {
            const portrait = this.portraits[user.id];
            let image = user.image;
            if (!image) {
                image = "/unknown.png";
            }
            const imageElement = portrait.querySelector("img");
            imageElement.src = image;
            const nameElement = portrait.querySelector(".name");
            nameElement.textContent = user.name;
        });

        Events.register("userDelete", (userId: string) => {
            const portrait = this.portraits[userId];
            portrait.remove();
        });
    }
}


registerWindowType(PresenceWindow);
