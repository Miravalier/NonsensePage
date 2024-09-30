import * as ContextMenu from "../lib/ContextMenu.ts";
import { Vector2 } from "../lib/Vector.ts";
import { ConfirmDialog, ContentWindow, InputDialog, registerWindowType } from "./Window.ts";
import { ApiRequest } from "../lib/Requests.ts";
import { ErrorToast } from "../lib/Notifications.ts";
import { Parameter, IsDefined, GetThumbnail, Require } from "../lib/Utils.ts";
import { TitleCase } from "../lib/Utils.ts";
import { AddDragListener } from "../lib/Drag.ts";


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

    async contextMenuHook(id: string, contextOptions: { [choice: string]: (ev: MouseEvent) => void }) {

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
            if (dropData.type == `${this.entryType}Folder`) {
                await ApiRequest(`/${this.entryType}/move`, { folder_id: dropData.id, dst_id: id });
            }
            else if (dropData.type == this.entryType) {
                await ApiRequest(`/${this.entryType}/move`, { [`${this.entryType}_id`]: dropData.id, dst_id: id });
            }
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
            if (dropData.type == `${this.entryType}Folder`) {
                if (dropData.id == id) {
                    return;
                }
                await ApiRequest(`/${this.entryType}/move`, { folder_id: dropData.id, dst_id: id });

            }
            else if (dropData.type == this.entryType) {
                await ApiRequest(`/${this.entryType}/move`, { [`${this.entryType}_id`]: dropData.id, dst_id: id });
            }
        });
        ContextMenu.set(element, {
            "Edit Folder": {
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
        });
    }

    async addEntry(id: string, name: string, image: string = null) {
        const element = this.entryList.appendChild(document.createElement("div"));
        element.dataset.id = id;
        element.className = `${this.entryType} entry`;
        const icon = element.appendChild(document.createElement("img"));
        icon.className = "thumbnail";
        if (image) {
            icon.src = await GetThumbnail(image);
        }
        else {
            icon.src = "/unknown.png";
        }
        element.appendChild(document.createTextNode(name));
        element.addEventListener("click", () => this.openEntryHandler(id));
        AddDragListener(element, { type: this.entryType, id });
        const contextOptions = {
            "Rename": async () => {
                const selection = await InputDialog(`Rename ${TitleCase(this.entryType)}`, { "Name": "text" }, "Rename");
                if (!selection || !selection.Name) {
                    return;
                }
                await ApiRequest(`/${this.entryType}/update`, {
                    id,
                    changes: {
                        "$set": {
                            name: selection.Name,
                        },
                    },
                });
            },
            "Delete": async () => {
                if (!await ConfirmDialog(`Delete '${name}'`)) {
                    return;
                }
                await ApiRequest(`/${this.entryType}/delete`, { id });
                element.remove();
            },
        };
        this.contextMenuHook(id, contextOptions);
        ContextMenu.set(element, {
            [TitleCase(this.entryType)]: contextOptions,
        });
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
            entries: [string, string, string][],
        } = await ApiRequest(`/${this.entryType}/list`, { folder_id: this.folderId });
        if (response.status != "success") {
            ErrorToast(`Failed to load ${this.entryType} list.`);
            this.close();
            return;
        }

        if (this.folderId) {
            this.setTitle(`${TitleCase(this.entryType)}s - ${response.name}`);
            await this.addParentFolder(response.parent_id);
        }
        else {
            this.setTitle(`${TitleCase(this.entryType)}s`);
        }

        for (let [id, name] of response.subfolders) {
            await this.addFolder(id, name);
        }

        for (let [id, name, image] of response.entries) {
            await this.addEntry(id, name, image);
        }

        await this.subscribe(`${this.entryType}s`, async updateData => {
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
                await this.addEntry(updateData.id, updateData.name, null);
            }
            else if (updateData.type == "rename") {
                if (updateData.folder != this.folderId) {
                    return;
                }
                const entryDiv = this.entryList.querySelector(`[data-id="${updateData.id}"]`);
                if (entryDiv) {
                    entryDiv.textContent = updateData.name;
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
                    await this.addEntry(updateData.id, updateData.name, updateData.image);
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
                await this.addFolder(updateData.id, updateData.name);
            }
            else if (updateData.type == "movedir") {
                if (updateData.src == this.folderId) {
                    const folderDiv = this.entryList.querySelector(`[data-folder="${updateData.id}"]`);
                    if (folderDiv) {
                        folderDiv.remove();
                    }
                }
                else if (updateData.dst == this.folderId) {
                    await this.addFolder(updateData.id, updateData.name);
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
