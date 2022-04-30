import { ContentWindow } from "./window.js";
import { ApiRequest, Session } from "./requests.js";


export class CharacterWindow extends ContentWindow {
    constructor(options) {
        options.classList = ["character"];
        super(options);
        this.ws = null;
    }

    close() {
        if (this.ws) {
            this.ws.close();
        }
        super.close();
    }

    async load(id) {
        const sheetType = "generic";
        // Load sheet content
        const sheetClass = await import(`./${sheetType}-sheet.js`);
        await sheetClass.default.render(this.content);
        this.titleNode.textContent = `Character Sheet - Bob`;
    }
}
