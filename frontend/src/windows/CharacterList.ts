import * as ContextMenu from "../lib/ContextMenu.ts";
import { Vector2 } from "../lib/Vector.ts";
import { ConfirmDialog, ContentWindow, InputDialog, registerWindowType } from "./Window.ts";
import { ApiRequest } from "../lib/Requests.ts";
import { ErrorToast } from "../lib/Notifications.ts";
import { CharacterSheetWindow } from "./CharacterSheet.ts";
import { Parameter, AddDragListener, IsDefined, GetThumbnail } from "../lib/Utils.ts";


export class CharacterListWindow extends ContentWindow {
    characters: HTMLDivElement;
    createCharacterButton: HTMLButtonElement;
    createFolderButton: HTMLButtonElement;
    folderId: string;
    ancestorIds: Set<string>;

    constructor(options) {
        options.classList = ["character-list"];
        options.refreshable = Parameter(options.refreshable, true);
        options.size = Parameter(options.size, new Vector2(300, 400));
        options.title = Parameter(options.title, "Characters");
        super(options);
        this.characters = this.content.appendChild(document.createElement("div"));
        this.characters.className = "characters";

        this.createCharacterButton = this.content.appendChild(document.createElement("button"));
        this.createCharacterButton.className = "create-character";
        this.createCharacterButton.type = "button";
        this.createCharacterButton.innerText = "Create Character";
        this.createCharacterButton.addEventListener("click", async () => {
            const selection = await InputDialog("Create Character", { "Name": "text" }, "Create");
            if (!selection || !selection.Name) {
                return;
            }
            await ApiRequest("/character/create", {
                name: selection.Name,
                folder_id: this.folderId,
            });
        });

        this.createFolderButton = this.content.appendChild(document.createElement("button"));
        this.createFolderButton.className = "create-folder";
        this.createFolderButton.type = "button";
        this.createFolderButton.innerText = "Create Folder";
        this.createFolderButton.addEventListener("click", async () => {
            const selection = await InputDialog("Create Character Folder", { "Name": "text" }, "Create");
            if (!selection || !selection.Name) {
                return;
            }
            await ApiRequest("/character/folder/create", { name: selection.Name, parent: this.folderId });
        });

        this.folderId = null;
        this.ancestorIds = new Set();
    }

    async addParentFolder(id: string) {
        const element = this.characters.appendChild(document.createElement("div"));
        element.dataset.folder = id;
        element.className = "character folder";
        element.innerHTML = `<i class="fa-solid fa-folder-arrow-up"></i> ..`;
        element.addEventListener("click", async () => {
            this.ancestorIds.delete(this.folderId);
            await this.load(id);
        });
        this.addDropListener(element, async (dropData) => {
            if (dropData.type == "characterFolder") {
                await ApiRequest("/character/move", { folder_id: dropData.id, dst_id: id });
            }
            else if (dropData.type == "character") {
                await ApiRequest("/character/move", { character_id: dropData.id, dst_id: id });
            }
        });
    }

    async addFolder(id: string, name: string) {
        const element = this.characters.appendChild(document.createElement("div"));
        element.dataset.folder = id;
        element.className = "character folder";
        element.innerHTML = `<i class="fa-solid fa-folder"></i> ${name}`;
        element.addEventListener("click", async () => {
            await this.load(id);
        });
        AddDragListener(element, { type: "characterFolder", id });
        this.addDropListener(element, async (dropData) => {
            if (dropData.type == "characterFolder") {
                if (dropData.id == id) {
                    return;
                }
                await ApiRequest("/character/move", { folder_id: dropData.id, dst_id: id });

            }
            else if (dropData.type == "character") {
                await ApiRequest("/character/move", { character_id: dropData.id, dst_id: id });
            }
        });
        ContextMenu.set(element, {
            "Edit Folder": {
                "Rename": async () => {
                    const selection = await InputDialog("Rename Folder", { "Name": "text" }, "Rename");
                    if (!selection || !selection.Name) {
                        return;
                    }
                    await ApiRequest("/character/folder/rename", {
                        id,
                        name: selection.Name,
                    });
                },
                "Delete": async () => {
                    if (!await ConfirmDialog(`Delete '${name}'`)) {
                        return;
                    }
                    await ApiRequest("/character/folder/delete", { folder_id: id });
                }
            }
        });
    }

    async addCharacter(id: string, name: string, image: string = null) {
        const element = this.characters.appendChild(document.createElement("div"));
        element.dataset.character = id;
        element.className = "character";
        const icon = element.appendChild(document.createElement("img"));
        icon.className = "thumbnail";
        if (image) {
            icon.src = await GetThumbnail(image);
        }
        else {
            icon.src = "/unknown.png";
        }
        element.appendChild(document.createTextNode(name));
        element.addEventListener("click", async () => {
            const characterSheetWindow = new CharacterSheetWindow({
                title: "Character Sheet",
            });
            await characterSheetWindow.load(id);
        });
        AddDragListener(element, { type: "character", id });
        ContextMenu.set(element, {
            "Edit Character": {
                "Rename": async () => {
                    const selection = await InputDialog("Rename Character", { "Name": "text" }, "Rename");
                    if (!selection || !selection.Name) {
                        return;
                    }
                    await ApiRequest("/character/update", {
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
                    await ApiRequest("/character/delete", { id });
                    element.remove();
                },
            },
        });
    }

    async load(folderId?: string) {
        console.log("Loading:", folderId);
        await super.load();
        this.characters.innerHTML = "";

        if (IsDefined(folderId)) {
            this.ancestorIds.add(folderId);
            this.folderId = folderId;
        }

        const response: {
            status: string,
            name: string,
            parent_id: string,
            subfolders: [string, string][],
            characters: [string, string, string][],
        } = await ApiRequest("/character/list", { folder_id: this.folderId });
        if (response.status != "success") {
            ErrorToast("Failed to load character list.");
            this.close();
            return;
        }

        if (this.folderId) {
            this.setTitle(`Characters - ${response.name}`);
            await this.addParentFolder(response.parent_id);
        }
        else {
            this.setTitle("Characters");
        }

        for (let [id, name] of response.subfolders) {
            await this.addFolder(id, name);
        }

        for (let [id, name, image] of response.characters) {
            await this.addCharacter(id, name, image);
        }

        await this.subscribe("characters", async updateData => {
            if (updateData.type == "delete") {
                if (updateData.folder != this.folderId) {
                    return;
                }
                const characterDiv = this.characters.querySelector(`[data-character="${updateData.id}"]`);
                if (characterDiv) {
                    characterDiv.remove();
                }
            }
            else if (updateData.type == "create") {
                if (updateData.folder != this.folderId) {
                    return;
                }
                await this.addCharacter(updateData.id, updateData.name, null);
            }
            else if (updateData.type == "rename") {
                if (updateData.folder != this.folderId) {
                    return;
                }
                const characterDiv = this.characters.querySelector(`[data-character="${updateData.id}"]`);
                if (characterDiv) {
                    characterDiv.textContent = updateData.name;
                }
            }
            else if (updateData.type == "move") {
                if (updateData.src == this.folderId) {
                    const characterDiv = this.characters.querySelector(`[data-character="${updateData.id}"]`);
                    if (characterDiv) {
                        characterDiv.remove();
                    }
                }
                else if (updateData.dst == this.folderId) {
                    await this.addCharacter(updateData.id, updateData.name, updateData.image);
                }
            }
            else if (updateData.type == "rmdir") {
                if (this.ancestorIds.has(updateData.folder)) {
                    this.close();
                }
                else {
                    const folderDiv = this.characters.querySelector(`[data-folder="${updateData.folder}"]`);
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
                    const folderDiv = this.characters.querySelector(`[data-folder="${updateData.id}"]`);
                    if (folderDiv) {
                        folderDiv.remove();
                    }
                }
                else if (updateData.dst == this.folderId) {
                    await this.addFolder(updateData.id, updateData.name);
                }
            }
            else if (updateData.type == "renamedir") {
                const folderDiv = this.characters.querySelector(`[data-folder="${updateData.folder}"]`);
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
registerWindowType(CharacterListWindow);
