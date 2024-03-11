import * as ContextMenu from "./contextmenu.js";
import { Vector2 } from "./vector.js";
import { ContentWindow, InputDialog, registerWindowType } from "./window.js";
import { ApiRequest, Session } from "./requests.js";
import { ErrorToast } from "./notifications.js";
import { CharacterSheetWindow } from "./character_sheet_window.js";
import { Parameter, AddDragListener } from "./utils.js";


export class CharacterListWindow extends ContentWindow {
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
            else if (updateData.type == "create") {
                await this.addCharacter(updateData.id, updateData.name);
            }
            else if (updateData.type == "rename") {
                const characterDiv = this.characters.querySelector(`[data-character="${updateData.id}"]`);
                if (characterDiv) {
                    characterDiv.textContent = updateData.name;
                }
            }
        });
    }
}
registerWindowType(CharacterListWindow);
