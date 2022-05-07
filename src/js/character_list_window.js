import { ContentWindow } from "./window.js";
import { ApiRequest, Session } from "./requests.js";
import { ErrorToast } from "./notifications.js";
import { CharacterSheetWindow } from "./character_sheet_window.js";


export class CharacterListWindow extends ContentWindow {
    constructor(options) {
        options.classList = ["character-list"];
        super(options);
        this.characters = this.content.appendChild(document.createElement("div"));
        this.characters.className = "characters";
        this.createCharacterButton = this.content.appendChild(document.createElement("button"));
        this.createCharacterButton.className = "create-character";
        this.createCharacterButton.appendChild(document.createTextNode("Create Character"));
        this.createCharacterButton.addEventListener("click", async () => {
            await ApiRequest("/character/create", { name: `${Session.username}'s Character` });
        });
    }

    async load() {
        const response = await ApiRequest("/character/list");
        if (response.status != "success") {
            ErrorToast("Failed to load character list.");
            return;
        }

        for (const [id, name] of response.characters) {
            const element = this.characters.appendChild(document.createElement("div"));
            element.className = "character";
            element.appendChild(document.createTextNode(name));
            element.addEventListener("click", async () => {
                const characterSheetWindow = new CharacterSheetWindow({
                    title: "Character Sheet",
                });
                await characterSheetWindow.load(id);
            });
        }
    }
}
