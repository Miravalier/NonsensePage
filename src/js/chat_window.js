import { ContentWindow } from "./window.js";
import { ApiRequest } from "./requests.js";
import { DerivePcgEngine, RandomText } from "./utils.js";


const LANGUAGES = [
    "common",
];


export class ChatWindow extends ContentWindow {
    constructor(options) {
        super(options);
        this.messages = {};
        this.messageContainer = this.content.appendChild(document.createElement("div"));
        this.messageContainer.className = "messages";
    }

    async loadRecents() {
        this.messageContainer.remove()
        this.messageContainer = this.content.appendChild(document.createElement("div"));
        this.messageContainer.className = "messages";

        const response = await ApiRequest("/messages/recent");
        if (response.status != "success") {
            this.messageContainer.className = "messages-error";
            this.messageContainer.appendChild(document.createTextNode(`Error: Failed to chat messages`));
            return;
        }

        this.titleNode.textContent = `Chat`;
        for (const message of response.messages) {
            this.messages[message.id] = await this.addMessage(message);
        }
    }

    async addMessage(message) {
        const element = this.messageContainer.appendChild(document.createElement("div"));
        element.className = "message";

        const header = element.appendChild(document.createElement("div"));
        header.className = "header"

        const timestamp = header.appendChild(document.createElement("div"));
        timestamp.className = "timestamp";
        timestamp.appendChild(document.createTextNode(message.timestamp));

        const speaker = header.appendChild(document.createElement("div"));
        speaker.className = "speaker";
        speaker.appendChild(document.createTextNode(message.speaker));

        const content = element.appendChild(document.createElement("div"));
        if (message.content) {
            content.classList = `content spoken ${LANGUAGES[message.language]}`;
            content.appendChild(document.createTextNode(message.content));
        }
        else {
            const engine = await DerivePcgEngine(message.id);
            content.classList = `content foreign ${LANGUAGES[message.language]}`;
            content.appendChild(document.createTextNode(
                RandomText(engine, message.length)
            ));
        }

        return element;
    }
}
