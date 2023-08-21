import * as ContextMenu from "./contextmenu.js";
import { Vector2 } from "./vector.js";
import { ContentWindow, InputDialog } from "./window.js";
import { ApiRequest, Session } from "./requests.js";
import { Parameter, DerivePcgEngine, RandomText, ParseHtml } from "./utils.js";


const LANGUAGES = [
    "common",
];


export class ChatWindow extends ContentWindow {
    constructor(options) {
        options.classList = ["chat"];
        options.size = Parameter(options.size, new Vector2(400, 600));
        super(options);
        this.messages = {};
        this.messageContainer = this.content.appendChild(document.createElement("div"));
        this.messageContainer.className = "messages";
        this.inputSection = this.content.appendChild(document.createElement("div"));
        this.inputSection.className = "input-section";
        this.textarea = this.inputSection.appendChild(document.createElement("textarea"));
        this.textarea.maxLength = 10000;

        this.textarea.addEventListener("keypress", async ev => {
            if (ev.key == "Enter" && !ev.shiftKey) {
                ev.preventDefault();
                const content = this.textarea.value.trim();
                this.textarea.value = "";
                if (content) {
                    await ApiRequest("/messages/speak", { content: content, speaker: Session.username });
                }
            }
        });

        if (Session.gm) {
            ContextMenu.set(this.viewPort, {
                "Edit Chat": {
                    "Save": async ev => {
                        const selection = await InputDialog("Save Chat", { "Filename": "text" }, "Save");
                        if (!selection || !selection.Filename) {
                            return;
                        }
                        await ApiRequest("/messages/save", { filename: selection.Filename });
                    },
                    "Clear": async ev => {
                        await ApiRequest("/messages/clear");
                    },
                },
            });
        }
    }

    async load() {
        await super.load();

        await this.subscribe("messages", async data => {
            if (data.type == "send") {
                this.addMessage(data);
            }
            else if (data.type == "edit") {
                const message = this.messages[data.id];
                if (!message) {
                    console.warn(`Received edit for non-existing message id ${data.id}`);
                    return;
                }
                const contentElement = message.querySelector(".text");
                contentElement.innerHTML = data.content;
            }
            else if (data.type == "delete") {
                const message = this.messages[data.id];
                if (!message) {
                    console.error(`Received delete for non-existing message id ${data.id}`);
                    return;
                }
                message.remove();
                delete this.messages[data.id];
            }
            else if (data.type == "clear") {
                this.messages = {};
                this.messageContainer.innerHTML = "";
            }
        });

        const response = await ApiRequest("/messages/recent");
        if (response.status != "success") {
            this.messageContainer.className = "messages-error";
            this.messageContainer.appendChild(document.createTextNode(`Error: Failed to chat messages`));
            return;
        }

        this.setTitle(`Chat`);
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
        element.dataset.id = message.id;

        if (Session.gm) {
            ContextMenu.set(element, {
                "Edit Message": {
                    "Edit": async ev => {
                        const selection = await InputDialog("Edit Message", { "Content": ["paragraph", message.content] }, "Save");
                        if (!selection || !selection.Content) {
                            return;
                        }

                        message.content = selection.Content;
                        await ApiRequest("/messages/edit", { id: message.id, content: selection.Content });
                    },
                    "Delete": async ev => {
                        await ApiRequest("/messages/delete", { id: message.id });
                    },
                },
            });
        }

        const header = element.appendChild(document.createElement("div"));
        header.className = "header"

        const speaker = header.appendChild(document.createElement("div"));
        speaker.className = "speaker";
        speaker.appendChild(document.createTextNode(message.speaker));

        const messageDate = new Date(message.timestamp * 1000);
        const timestamp = header.appendChild(document.createElement("div"));
        timestamp.className = "timestamp";
        timestamp.appendChild(document.createTextNode(messageDate.toLocaleString()));

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
