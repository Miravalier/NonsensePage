import { ContentWindow } from "./window.js";
import { Vector2 } from "./vector.js";
import { ApiRequest } from "./requests.js";
import { Templates } from "./templates.js";
import { ErrorToast } from "./notifications.js";
import { GenerateId, Parameter } from "./utils.js";


export class CharacterSheetWindow extends ContentWindow {
    constructor(options) {
        options.classList = ["character"];
        options.size = Parameter(options.size, new Vector2(540, 600));
        super(options);
        this.id = null;
    }

    async load(id) {
        await super.load();
        this.content.innerHTML = "";
        this.id = id;

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
        const sheetClass = (await import(`./${sheetType}-sheet.js?v=${version}`)).default;
        await Templates.loadCss(`${sheetType}-sheet.css?v=${version}`);
        this.content.appendChild(await Templates.loadHtml(`${sheetType}-sheet.html?v=${version}`));
        const sheet = new sheetClass(characterData.id, this);
        sheet.onLoad(characterData);
        sheet.addListeners();
        sheet.update(characterData);

        // Set up update watcher
        await this.subscribe(id, async updateData => {
            sheet.update(updateData.changes);
        });
    }

    serialize() {
        return {id: this.id};
    }

    deserialize(data) {
        this.load(data.id);
    }
}
