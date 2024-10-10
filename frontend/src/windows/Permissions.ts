import * as ContextMenu from "../lib/ContextMenu.ts";
import * as Database from "../lib/Database.ts";
import { ContentWindow, InputDialog, registerWindowType } from "./Window.ts";
import { Vector2 } from "../lib/Vector.ts";
import { IsDefined, Parameter, TitleCase } from "../lib/Utils.ts";
import { ApiRequest } from "../lib/Requests.ts";
import { ErrorToast } from "../lib/Notifications.ts";
import { Permission } from "../lib/Models.ts";
import { Html } from "../lib/Elements.ts";


export class PermissionsWindow extends ContentWindow {
    entryType: string;
    id: string;
    groups: HTMLDivElement;
    permissions: any;

    constructor(options = undefined) {
        options = Parameter(options, {});
        options.classList = ["permissions"];
        options.size = Parameter(options.size, new Vector2(380, 520));
        options.title = Parameter(options.title, "Permissions");
        super(options);
    }

    async load(entryType: string = undefined, id: string = undefined) {
        await super.load();
        this.content.innerHTML = "";
        if (IsDefined(entryType)) {
            this.entryType = entryType;
        }
        if (IsDefined(id)) {
            this.id = id;
        }

        this.setTitle(`${TitleCase(this.entryType)} Permissions`);

        await this.getPermissions();

        this.groups = this.content.appendChild(Html('<div class="groups"></div>')) as HTMLDivElement;
        this.renderPermissions();

        const buttons = this.content.appendChild(Html('<div class="buttons"></div>')) as HTMLDivElement;

        const saveButton = buttons.appendChild(Html('<button type="button">Save</button>')) as HTMLButtonElement;
        saveButton.addEventListener("click", async () => {
            await this.setPermissions();
            this.close();
        });

        const cancelButton = buttons.appendChild(Html('<button type="button">Cancel</button>')) as HTMLButtonElement;
        cancelButton.addEventListener("click", () => {
            this.close();
        });

        ContextMenu.set(this.viewPort, {
            "Permissions": {
                "Add Player": () => this.addSource(),
            }
        });
    }

    async getPermissions() {
        const response = await ApiRequest(`/${this.entryType}/get`, { id: this.id });
        if (response.status !== "success") {
            ErrorToast(`Failed to load permissions for ${this.entryType}.`);
            this.close();
        }

        this.permissions = response[this.entryType].permissions;
    }

    async setPermissions() {
        await ApiRequest(`/${this.entryType}/update`, {
            id: this.id,
            changes: { "$set": { "permissions": this.permissions } }
        });
    }

    async addSource() {
        const userOptions = {};
        if (!IsDefined(this.permissions["*"])) {
            userOptions["*"] = "All Players";
        }
        for (const [id, user] of Object.entries(Database.users)) {
            if (IsDefined(this.permissions[id])) {
                continue;
            }
            userOptions[id] = user.name;
        }
        const selection = await InputDialog("Add Player", { "Player": ["select", userOptions] }, "Add");
        if (!selection || !selection.Player) {
            return;
        }
        this.permissions[selection.Player] = { "*": Permission.Inherit };
        this.renderPermissions();
    }

    renderPermissions() {
        this.groups.innerHTML = "";
        for (let [source, scopes] of Object.entries(this.permissions)) {
            const groupElement = this.groups.appendChild(Html(`<div class="group"></div>`)) as HTMLDivElement;
            const sourceSelect = groupElement.appendChild(Html(`
                <select name="source" class="source">
                    <option value="*">All Players</option>
                </select>
            `)) as HTMLSelectElement;
            for (const [userId, user] of Object.entries(Database.users)) {
                sourceSelect.appendChild(Html(`<option value="${userId}">${user.name}</option>`));
            }
            sourceSelect.value = source;
            sourceSelect.addEventListener("change", () => {
                // If this new source is taken, cancel the change
                if (IsDefined(this.permissions[sourceSelect.value])) {
                    ErrorToast("Duplicate permission source.");
                    sourceSelect.value = source;
                    return;
                }
                this.permissions[sourceSelect.value] = this.permissions[source];
                delete this.permissions[source];
                source = sourceSelect.value;
            });

            for (let [scope, permission] of Object.entries(scopes)) {
                const pairElement = groupElement.appendChild(Html(`
                    <div class="pair">
                        <input type="text" class="scope" />
                        <select name="permission" class="permission">
                            <option value="Inherit">Inherit</option>
                            <option value="None">None</option>
                            <option value="Read">Read</option>
                            <option value="Write">Write</option>
                            <option value="Owner">Owner</option>
                        </select>
                    </div>
                `));
                const scopeInput = pairElement.querySelector("input");
                const permissionSelect = pairElement.querySelector("select");
                scopeInput.value = scope;
                permissionSelect.value = Permission[permission];

                scopeInput.addEventListener("change", () => {
                    // If this new scope is taken, cancel the change
                    if (IsDefined(this.permissions[source][scopeInput.value])) {
                        ErrorToast("Duplicate permission scope.");
                        scopeInput.value = scope;
                        return;
                    }
                    this.permissions[source][scopeInput.value] = this.permissions[source][scope];
                    delete this.permissions[source][scope];
                    scope = scopeInput.value;
                });

                permissionSelect.addEventListener("change", () => {
                    this.permissions[source][scope] = Permission[permissionSelect.value];
                });

                ContextMenu.set(pairElement, {
                    "Permissions": {
                        "Add Scope": async () => {
                            this.permissions[source]["New Scope"] = Permission.Inherit;
                            this.renderPermissions();
                        },
                        "Delete Scope": async () => {
                            delete this.permissions[source][scope];
                            if (Object.keys(this.permissions[source]).length == 0) {
                                delete this.permissions[source];
                            }
                            this.renderPermissions();
                        },
                    }
                })
            }

            ContextMenu.set(groupElement, {
                "Permissions": {
                    "Add Player": () => this.addSource(),
                    "Delete Player": async () => {
                        delete this.permissions[source];
                        this.renderPermissions();
                    },
                }
            });
        }
    }

    serialize() {
        return { entryType: this.entryType, id: this.id };
    }

    async deserialize(data) {
        await this.load(data.entryType, data.id);
    }
}


registerWindowType(PermissionsWindow);
