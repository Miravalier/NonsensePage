import * as Events from "../lib/Events.ts";
import * as Database from "../lib/Database.ts";
import { InvisibleWindow, registerWindowType } from "./Window.ts";
import { Parameter } from "../lib/Utils.ts";
import { User } from "../lib/Models.ts";
import { Html } from "../lib/Elements.ts";


export class PresenceWindow extends InvisibleWindow {
    portraits: { [id: string]: HTMLDivElement };

    constructor(options = undefined) {
        options = Parameter(options, {});
        options.classList = ["presence"];
        options.title = Parameter(options.title, "User Presence");
        super(options);
    }

    async load(_data = undefined) {
        await super.load();
        this.content.innerHTML = "";
        this.portraits = {};

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
