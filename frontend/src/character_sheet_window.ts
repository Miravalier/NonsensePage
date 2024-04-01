import { ContentWindow, registerWindowType } from "./window.ts";
import { Vector2 } from "./vector.ts";
import { ApiRequest } from "./requests.ts";
import { Templates } from "./templates.ts";
import { ErrorToast } from "./notifications.ts";
import { Parameter } from "./utils.ts";


export class CharacterSheetWindow extends ContentWindow {
    characterId: string;

    constructor(options) {
        options.classList = ["character"];
        options.size = Parameter(options.size, new Vector2(540, 600));
        super(options);
        this.characterId = null;
    }

    async load(id: string) {
        await super.load();
        this.content.innerHTML = "";
        this.characterId = id;

        // Get character data
        const response = await ApiRequest("/character/get", { id });
        if (response.status != "success") {
            ErrorToast("Character loading failed!");
            return;
        }
        const characterData = response.character;
        this.setTitle(characterData.name);
        const sheetType = characterData.sheet_type;

        // Load sheet content
        const version = "1";
        //const sheetClass = (await import(`./${sheetType}-sheet.js?v=${version}`)).default;
        await Templates.loadCss(`${sheetType}-sheet.css?v=${version}`);
        this.content.appendChild(await Templates.loadHtml(`${sheetType}-sheet.html?v=${version}`));
        //const sheet = new sheetClass(characterData.id, this);
        // sheet.onLoad(characterData);
        // sheet.addListeners();
        // sheet.update(characterData);

        // Set up update watcher
        await this.subscribe(id, async updateData => {
            // sheet.update(updateData.changes);
        });
    }

    serialize() {
        return { characterId: this.characterId };
    }

    async deserialize(data) {
        await this.load(data.characterId);
    }
}
registerWindowType(CharacterSheetWindow);
