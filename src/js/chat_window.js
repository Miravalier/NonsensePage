import { ContentWindow } from "./window.js";
import { ApiRequest, Subscribe, Session } from "./requests.js";
import { DerivePcgEngine, RandomText, ParseHtml } from "./utils.js";


const LANGUAGES = [
    "common",
];


export class ChatWindow extends ContentWindow {
    constructor(options) {
        options.classList = ["chat"];
        super(options);
        this.ws = null;
        this.messages = {};
        this.messageContainer = this.content.appendChild(document.createElement("div"));
        this.messageContainer.className = "messages";
        this.inputSection = this.content.appendChild(document.createElement("div"));
        this.inputSection.className = "input-section";
        this.textarea = this.inputSection.appendChild(document.createElement("textarea"));

        this.textarea.addEventListener("keypress", async ev => {
            if (ev.key == "Enter" && !ev.shiftKey) {
                ev.preventDefault();
                const content = this.textarea.value;
                this.textarea.value = "";
                await ApiRequest("/messages/speak", { content: content, speaker: Session.username });
            }
        })
    }

    close() {
        if (this.subscription) {
            this.subscription.cancel();
        }
        super.close();
    }

    async loadMessages() {
        this.subscription = await Subscribe("messages", async data => {
            if (data.type == "send") {
                this.addMessage(data);
            }
            else if (data.type == "edit") {
                message = this.messages[data.id];
                if (!message) {
                    console.error(`Received edit for non-existing message id ${data.id}`);
                    return;
                }
                const contentElement = message.querySelector(".content");
                contentElement.firstChild.textContent = data.content;
            }
            else if (data.type == "delete") {
                message = this.messages[data.id];
                if (!message) {
                    console.error(`Received delete for non-existing message id ${data.id}`);
                    return;
                }
                message.remove();
                delete this.messages[data.id];
            }
        });

        const response = await ApiRequest("/messages/recent");
        if (response.status != "success") {
            this.messageContainer.className = "messages-error";
            this.messageContainer.appendChild(document.createTextNode(`Error: Failed to chat messages`));
            return;
        }

        this.titleNode.textContent = `Chat`;
        for (const message of response.messages) {
            this.addMessage(message);
        }
    }

    addMessage(message) {
        if (this.messages[message.id]) {
            return null;
        }

        const element = this.messageContainer.appendChild(document.createElement("div"));
        element.className = "message";

        const header = element.appendChild(document.createElement("div"));
        header.className = "header"

        const speaker = header.appendChild(document.createElement("div"));
        speaker.className = "speaker";
        speaker.appendChild(document.createTextNode(message.speaker));

        const timestamp = header.appendChild(document.createElement("div"));
        timestamp.className = "timestamp";
        timestamp.appendChild(document.createTextNode(message.timestamp));

        const content = element.appendChild(document.createElement("div"));
        if (message.content) {
            content.classList = `text spoken ${LANGUAGES[message.language]}`;
            content.appendChild(ParseHtml(message.content));
        }
        else {
            const engine = DerivePcgEngine(message.id);
            content.classList = `text foreign ${LANGUAGES[message.language]}`;
            content.appendChild(document.createTextNode(
                RandomText(engine, message.length)
            ));
        }



        this.viewPort.scrollTop = this.viewPort.scrollHeight;

        this.messages[message.id] = element;
        return element;
    }
}
