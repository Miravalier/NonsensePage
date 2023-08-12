import { ContentWindow } from "./window.js";
import { ApiRequest, Subscribe } from "./requests.js";
import { Templates } from "./templates.js";
import { ErrorToast } from "./notifications.js";


export class CharacterSheetWindow extends ContentWindow {
    constructor(options) {
        options.classList = ["character"];
        super(options);
        this.subscription = null;
    }

    close() {
        if (this.subscription) {
            this.subscription.cancel();
        }
        super.close();
    }

    async load(id) {
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
        this.subscription = await Subscribe(id, async updateData => {
            sheet.update(updateData.changes);
        });
    }
}
