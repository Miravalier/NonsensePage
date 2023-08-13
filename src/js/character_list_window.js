import * as ContextMenu from "./contextmenu.js";
import { Vector2 } from "./vector.js";
import { ContentWindow, Dialog } from "./window.js";
import { ApiRequest, Session } from "./requests.js";
import { ErrorToast } from "./notifications.js";
import { CharacterSheetWindow } from "./character_sheet_window.js";
import { Parameter, AddDragListener } from "./utils.js";
import { Html } from "./elements.js";


export class CharacterListWindow extends ContentWindow {
    constructor(options) {
        options.classList = ["character-list"];
        options.refreshable = Parameter(options.refreshable, true);
        options.size = Parameter(options.size, new Vector2(300, 400));
        super(options);
        this.characters = this.content.appendChild(document.createElement("div"));
        this.characters.className = "characters";
        this.createCharacterButton = this.content.appendChild(document.createElement("button"));
        this.createCharacterButton.className = "create-character";
        this.createCharacterButton.type = "button";
        this.createCharacterButton.appendChild(document.createTextNode("Create Character"));
        this.createCharacterButton.addEventListener("click", async () => {
            await ApiRequest("/character/create", { name: `${Session.username}'s Character` });
        });
    }

    async addCharacter(id, name) {
        const element = this.characters.appendChild(document.createElement("div"));
        element.dataset.character = id;
        element.className = "character";
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
                "Rename": async (ev) => {
                    const nameInput = Html(`<input type="text">`);
                    const renameButton = Html(`<button type="button">Rename</button>`);
                    const cancelButton = Html(`<button type="button">Cancel</button>`);
                    const dialog = new Dialog({
                        title: `Rename Character`,
                        elements: [
                            nameInput,
                            [renameButton, cancelButton]
                        ]
                    });
                    renameButton.addEventListener("click", async () => {
                        if (nameInput.value) {
                            await ApiRequest("/character/update", {
                                id,
                                changes: {
                                    "$set": {
                                        name: nameInput.value,
                                    },
                                },
                            });
                            element.textContent = nameInput.value;
                        }
                        dialog.close();
                    });
                    cancelButton.addEventListener("click", () => {
                        dialog.close();
                    });
                },
                "Delete": async (ev) => {
                    await ApiRequest("/character/delete", { id });
                    element.remove();
                },
            },
        });
    }

    async load() {
        await super.load();
        this.characters.innerHTML = "";

        const response = await ApiRequest("/character/list");
        if (response.status != "success") {
            ErrorToast("Failed to load character list.");
            this.close();
            return;
        }

        for (let [id, name] of response.characters) {
            await this.addCharacter(id, name);
        }

        await this.subscribe("characters", async updateData => {
            if (updateData.type == "delete") {
                const characterDiv = this.characters.querySelector(`[data-character="${updateData.id}"]`);
                if (characterDiv) {
                    characterDiv.remove();
                }
            }
            if (updateData.type == "create") {
                await this.addCharacter(updateData.id, updateData.name);
            }
        });
    }
}
