import * as ContextMenu from "../lib/ContextMenu.ts";
import * as Events from "../lib/Events.ts";
import { Vector2 } from "../lib/Vector.ts";
import { ConfirmDialog, ContentWindow, InputDialog, registerWindowType } from "./Window.ts";
import { ApiRequest, Session } from "../lib/Requests.ts";
import { ErrorToast } from "../lib/Notifications.ts";
import { Parameter, IsDefined, GetThumbnail, Require } from "../lib/Utils.ts";
import { Pluralize, TitleCase } from "../lib/Utils.ts";
import { AddDragListener } from "../lib/Drag.ts";
import { PermissionsWindow } from "./Permissions.ts";
import { FolderPermissionsWindow } from "./FolderPermissions.ts";
import { Entry } from "../lib/Models.ts";


export class EntryListWindow extends ContentWindow {
    entryType: string;
    entryList: HTMLDivElement;
    addEntryButton: HTMLButtonElement;
    createFolderButton: HTMLButtonElement;
    folderId: string;
    ancestorIds: Set<string>;

    constructor(options) {
        Require(options.entryType);
        options.refreshable = Parameter(options.refreshable, true);
        options.size = Parameter(options.size, new Vector2(300, 400));
        options.title = Parameter(options.title, `${TitleCase(options.entryType)}`);
        super(options);

        this.entryType = options.entryType;
        this.entryList = this.content.appendChild(document.createElement("div"));
        this.entryList.className = "entry-list";

        this.addEntryButton = this.content.appendChild(document.createElement("button"));
        this.addEntryButton.className = "add-entry";
        this.addEntryButton.type = "button";
        this.addEntryButton.innerText = `Create ${TitleCase(this.entryType)}`;
        this.addEntryButton.addEventListener("click", () => this.createEntryHandler());

        this.createFolderButton = this.content.appendChild(document.createElement("button"));
        this.createFolderButton.className = "create-folder";
        this.createFolderButton.type = "button";
        this.createFolderButton.innerText = "Create Folder";
        this.createFolderButton.addEventListener("click", () => this.createFolderHandler());

        this.folderId = null;
        this.ancestorIds = new Set();
    }

    async contextMenuHook(_type: string, _id: string, _contextOptions: { [choice: string]: (ev: MouseEvent) => void }) { }

    async onDrop(folderId: string, dropData: any) {
        if (dropData.type == `${this.entryType}Folder`) {
            if (dropData.id == folderId) {
                return;
            }
            await ApiRequest(`/${this.entryType}/move`, { folder_id: dropData.id, dst_id: folderId });
        }
        else if (dropData.type == `${this.entryType}Entry`) {
            await ApiRequest(`/${this.entryType}/move`, { [`${this.entryType}_id`]: dropData.id, dst_id: folderId });
        }
    }

    async createFolderHandler() {
        const selection = await InputDialog(`Create ${TitleCase(this.entryType)} Folder`, { "Name": "text" }, "Create");
        if (!selection || !selection.Name) {
            return;
        }
        await ApiRequest(`/${this.entryType}/folder/create`, { name: selection.Name, parent: this.folderId });
    }

    async createEntryHandler() {
        const selection = await InputDialog(`Create ${TitleCase(this.entryType)}`, { "Name": "text" }, "Create");
        if (!selection || !selection.Name) {
            return;
        }
        await ApiRequest(`/${this.entryType}/create`, {
            name: selection.Name,
            folder_id: this.folderId,
        });
    }

    async openEntryHandler(id: string) {
        ErrorToast(`Unimplemented function: openEntryHandler: ${id}`);
    }

    async addParentFolder(id: string) {
        const element = this.entryList.appendChild(document.createElement("div"));
        element.dataset.folder = id;
        element.className = `${this.entryType} entry folder`;
        element.innerHTML = `<i class="fa-solid fa-folder-arrow-up"></i> ..`;
        element.addEventListener("click", async () => {
            this.ancestorIds.delete(this.folderId);
            await this.load(id);
        });
        this.addDropListener(element, async (dropData) => {
            await this.onDrop(id, dropData);
        });
    }

    async addFolder(id: string, name: string) {
        const element = this.entryList.appendChild(document.createElement("div"));
        element.dataset.folder = id;
        element.className = `${this.entryType} entry folder`;
        element.innerHTML = `<i class="fa-solid fa-folder"></i> ${name}`;
        element.addEventListener("click", async () => {
            await this.load(id);
        });
        AddDragListener(element, { type: `${this.entryType}Folder`, id });
        this.addDropListener(element, async (dropData) => {
            await this.onDrop(id, dropData);
        });
        const contextOptions = {
            "Rename": async () => {
                const selection = await InputDialog("Rename Folder", { "Name": "text" }, "Rename");
                if (!selection || !selection.Name) {
                    return;
                }
                await ApiRequest(`/${this.entryType}/folder/rename`, {
                    id,
                    name: selection.Name,
                });
            },
            "Delete": async () => {
                if (!await ConfirmDialog(`Delete '${name}'`)) {
                    return;
                }
                await ApiRequest(`/${this.entryType}/folder/delete`, { folder_id: id });
            }
        }
        if (Session.gm) {
            contextOptions["Permissions"] = async () => {
                const permissionsEditor = new FolderPermissionsWindow();
                permissionsEditor.load(this.entryType, id);
            }
        }

        await this.contextMenuHook("folder", id, contextOptions);
        ContextMenu.set(element, { "Edit Folder": contextOptions });
    }

    async addEntry(entry: Entry) {
        const element = document.createElement("div");
        element.dataset.id = entry.id;
        element.className = `${this.entryType} entry`;
        const icon = element.appendChild(document.createElement("img"));
        icon.className = "thumbnail";
        if (entry.image) {
            icon.src = await GetThumbnail(entry.image);
        }
        else {
            icon.src = "/unknown.png";
        }
        element.appendChild(document.createTextNode(entry.name));
        element.addEventListener("click", () => this.openEntryHandler(entry.id));
        AddDragListener(element, { type: `${this.entryType}Entry`, id: entry.id });
        const contextOptions = {
            "Rename": async () => {
                const selection = await InputDialog(`Rename ${TitleCase(this.entryType)}`, { "Name": ["text", entry.name] }, "Rename");
                if (!selection || !selection.Name) {
                    return;
                }
                await ApiRequest(`/${this.entryType}/update`, {
                    id: entry.id,
                    changes: {
                        "$set": {
                            name: selection.Name,
                        },
                    },
                });
                entry.name = selection.Name;
            },
            "Delete": async () => {
                if (!await ConfirmDialog(`Delete '${entry.name}'`)) {
                    return;
                }
                await ApiRequest(`/${this.entryType}/delete`, { id: entry.id });
                element.remove();
            }
        };
        if (Session.gm) {
            contextOptions["Permissions"] = async () => {
                const permissionsEditor = new PermissionsWindow();
                permissionsEditor.load(this.entryType, entry.id);
            }
        }
        this.contextMenuHook("entry", entry.id, contextOptions);
        ContextMenu.set(element, {
            [TitleCase(this.entryType)]: contextOptions,
        });
        await Events.dispatch(`render${TitleCase(this.entryType)}Entry`, element, entry);
        this.entryList.appendChild(element);
    }

    async load(folderId?: string) {
        await super.load();
        this.entryList.innerHTML = "";

        if (IsDefined(folderId)) {
            this.ancestorIds.add(folderId);
            this.folderId = folderId;
        }

        const response: {
            status: string,
            name: string,
            parent_id: string,
            subfolders: [string, string][],
            entries: Entry[],
        } = await ApiRequest(`/${this.entryType}/list`, { folder_id: this.folderId });
        if (response.status != "success") {
            ErrorToast(`Failed to load ${this.entryType} list.`);
            this.close();
            return;
        }

        if (this.folderId) {
            this.setTitle(`${Pluralize(TitleCase(this.entryType))} - ${response.name}`);
            await this.addParentFolder(response.parent_id);
        }
        else {
            this.setTitle(`${Pluralize(TitleCase(this.entryType))}`);
        }

        for (let [id, name] of response.subfolders) {
            await this.addFolder(id, name);
        }

        for (let entry of response.entries) {
            await this.addEntry(entry);
        }

        this.addDropListener(this.viewPort, async (dropData) => {
            await this.onDrop(this.folderId, dropData);
        });

        await this.subscribe(`${Pluralize(this.entryType)}`, async updateData => {
            if (updateData.type == "delete") {
                if (updateData.folder != this.folderId) {
                    return;
                }
                const entryDiv = this.entryList.querySelector(`[data-id="${updateData.id}"]`);
                if (entryDiv) {
                    entryDiv.remove();
                }
            }
            else if (updateData.type == "create") {
                if (updateData.folder != this.folderId) {
                    return;
                }
                this.refresh();
            }
            else if (updateData.type == "rename") {
                if (updateData.folder != this.folderId) {
                    return;
                }
                const entryDiv = this.entryList.querySelector(`[data-id="${updateData.id}"]`);
                if (entryDiv) {
                    entryDiv.childNodes[1].textContent = updateData.name;
                }
            }
            else if (updateData.type == "move") {
                if (updateData.src == this.folderId) {
                    const entryDiv = this.entryList.querySelector(`[data-id="${updateData.id}"]`);
                    if (entryDiv) {
                        entryDiv.remove();
                    }
                }
                else if (updateData.dst == this.folderId) {
                    this.refresh();
                }
            }
            else if (updateData.type == "rmdir") {
                if (this.ancestorIds.has(updateData.folder)) {
                    this.close();
                }
                else {
                    const folderDiv = this.entryList.querySelector(`[data-folder="${updateData.folder}"]`);
                    if (folderDiv) {
                        folderDiv.remove();
                    }
                }
            }
            else if (updateData.type == "mkdir") {
                if (updateData.folder != this.folderId) {
                    return;
                }
                this.refresh();
            }
            else if (updateData.type == "movedir") {
                if (updateData.src == this.folderId) {
                    const folderDiv = this.entryList.querySelector(`[data-folder="${updateData.id}"]`);
                    if (folderDiv) {
                        folderDiv.remove();
                    }
                }
                else if (updateData.dst == this.folderId) {
                    this.refresh();
                }
            }
            else if (updateData.type == "renamedir") {
                const folderDiv = this.entryList.querySelector(`[data-folder="${updateData.folder}"]`);
                if (folderDiv) {
                    folderDiv.innerHTML = `<i class="fa-solid fa-folder"></i> ${updateData.name}`;
                }
            }
        });
    }

    serialize() {
        return { folderId: this.folderId };
    }

    async deserialize(data) {
        await this.load(data.folderId);
    }
}

registerWindowType(EntryListWindow);
