import { ContentWindow } from "./window.js";
import { Vector2 } from "./vector.js";
import { ApiRequest } from "./requests.js";
import { Templates } from "./templates.js";
import { ErrorToast } from "./notifications.js";
import { Parameter } from "./utils.js";


export class CharacterSheetWindow extends ContentWindow {
    constructor(options) {
        options.classList = ["character"];
        options.size = Parameter(options.size, new Vector2(540, 600));
        super(options);
    }

    async load(id) {
        await super.load();
        this.content.innerHTML = "";

        // Get character data
        const response = await ApiRequest("/character/get", { id });
        if (response.status != "success") {
            ErrorToast("Character loading failed!");
            return;
        }
        const characterData = response.character;
        this.titleNode.textContent = characterData.name;
        const sheetType = characterData.sheet_type;

        // Load sheet content
        const sheetClass = (await import(`./${sheetType}-sheet.js`)).default;
        await Templates.loadCss(`${sheetType}-sheet.css`);
        this.content.appendChild(await Templates.loadHtml(`${sheetType}-sheet.html`));
        const sheet = new sheetClass(characterData.id, this);
        sheet.onLoad(characterData);
        sheet.addListeners();
        sheet.update(characterData);

        // Set up update watcher
        await this.subscribe(id, async updateData => {
            sheet.update(updateData.changes);
        });
    }
}
