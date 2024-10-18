import * as Database from "../lib/Database.ts";
import * as Notifications from "../lib/Notifications.ts";
import { ContentWindow, InputDialog, registerWindowType } from "./Window.ts";
import { Vector2 } from "../lib/Vector.ts";
import { LogOut, Parameter, TitleCase } from "../lib/Utils.ts";
import { Html } from "../lib/Elements.ts";
import { ApiRequest, Session } from "../lib/Requests.ts";



export class SettingsWindow extends ContentWindow {
    groups: HTMLDivElement[];
    cursor: HTMLDivElement;

    constructor(options = undefined) {
        options = Parameter(options, {});
        options.classList = ["settings"];
        options.size = Parameter(options.size, new Vector2(380, 520));
        options.title = Parameter(options.title, "Settings");
        super(options);
        this.groups = [];
        this.cursor = this.content;
    }

    group(callback: CallableFunction) {
        this.startGroup();
        callback();
        this.endGroup();
    }

    startGroup() {
        let parent: HTMLDivElement = this.content;
        if (this.groups.length > 0) {
            parent = this.groups[this.groups.length - 1];
        }
        this.cursor = parent.appendChild(Html(`<div class="group"></div>`)) as HTMLDivElement;
        this.groups.push(this.cursor);
    }

    endGroup() {
        this.groups.pop();
        if (this.groups.length > 0) {
            this.cursor = this.groups[this.groups.length - 1];
        }
        else {
            this.cursor = this.content;
        }
    }

    addButton(name: string, callback: CallableFunction) {
        const button = this.cursor.appendChild(Html(`<button type="button">${name}</button>`)) as HTMLButtonElement;
        button.addEventListener("click", () => {
            callback();
        });
        return button;
    }

    addCategory(text: string) {
        return this.cursor.appendChild(Html(`<div class="category">${text}</div>`));
    }

    addCheckbox(name: string, path: string, defaultValue: boolean) {
        const container = this.cursor.appendChild(Html(`<div class="container"></div>`) as HTMLDivElement);
        const checkbox = container.appendChild(Html(`<input type="checkbox" class="${name}" name="${name}">`)) as HTMLInputElement;
        container.appendChild(Html(`<label for="${name}">${TitleCase(name)}</label>`)) as HTMLLabelElement;
        if (Database.GetSetting(path, defaultValue)) {
            checkbox.checked = true;
        }
        checkbox.addEventListener("change", () => {
            Database.ChangeSetting(path, checkbox.checked);
        });
        return checkbox;
    }

    async load(_data = undefined) {
        await super.load();
        this.content.innerHTML = "";

        this.group(() => {
            this.addButton("Refresh", () => {
                // @ts-ignore
                location.reload(true);
            });

            this.addButton("Log Out", () => {
                LogOut();
            });
        });

        this.addCategory("Combat Tracker Columns");

        this.group(() => {
            this.addCheckbox("image", "combat-tracker.columns.image", true);
            this.addCheckbox("name", "combat-tracker.columns.name", true);
            this.addCheckbox("shield", "combat-tracker.columns.shield", false);
            this.addCheckbox("hp", "combat-tracker.columns.hp", false);
            // this.addCheckbox("actions", "combat-tracker.columns.actions", false);
            // this.addCheckbox("reactions", "combat-tracker.columns.reactions", false);
            this.addCheckbox("initiative", "combat-tracker.columns.initiative", false);
        });

        if (Session.gm) {
            this.addCategory("GM");

            this.group(() => {
                this.addButton("Create User", async () => {
                    const selection = await InputDialog("Create User", {
                        "Username": "text",
                        "Password": "text",
                    }, "Create");
                    if (!selection || !selection.Username || !selection.Password) {
                        Notifications.WarningToast("User creation aborted");
                        return;
                    }
                    await ApiRequest(
                        "/user/create",
                        {
                            username: selection.Username,
                            password: selection.Password,
                        }
                    );
                });

                this.addButton("Release Character", async () => {
                    await ApiRequest("/user/update", {
                        id: Session.id,
                        changes: { "$set": { "character_id": null } },
                    });
                });
            });
        }
    }
}


registerWindowType(SettingsWindow);
