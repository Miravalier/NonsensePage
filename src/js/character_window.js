import { ContentWindow } from "./window.js";
import { ApiRequest, Session } from "./requests.js";
import { DerivePcgEngine, RandomText } from "./utils.js";
import { Templates } from "./templates.js";


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
        // Open websocket
        let ws_prefix = (window.location.protocol === "https:" ? "wss:" : "ws:");
        this.ws = new WebSocket(`${ws_prefix}//${window.location.host}/api/character/subscribe`);
        this.ws.onopen = ev => {
            this.ws.send(JSON.stringify({ "token": Session.token }));
        }
        this.ws.onmessage = ev => {
            const data = JSON.parse(ev.data);
            console.log("/api/character/subscribe", data);
        };
        this.titleNode.textContent = `Bob`;
    }
}
