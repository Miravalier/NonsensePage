import * as ContextMenu from "../lib/ContextMenu.ts";
import * as Dice from "../lib/Dice.ts";
import * as Events from "../lib/Events.ts";
import { Vector2 } from "../lib/Vector.ts";
import { ContentWindow, InputDialog, registerWindowType } from "./Window.ts";
import { ApiRequest, Session, HandleWsMessage } from "../lib/Requests.ts";
import {
    Parameter, DerivePcgEngine, RandomText,
    GenerateId, EscapeHtml,
} from "../lib/Utils.ts";
import { ErrorToast } from "../lib/Notifications.ts";
import { Language } from "../lib/Enums.ts";
import { Message } from "../lib/Models.ts";
import { GetSpeaker } from "../lib/Database.ts";


const LANGUAGES = [
    "common",
];


export const COMMANDS = {
    "r": rollCommand,
    "roll": rollCommand,
    "e": emoteCommand,
    "em": emoteCommand,
    "emote": emoteCommand,
    "me": memoteCommand,
    "memote": memoteCommand,
    "o": oocCommand,
    "oc": oocCommand,
    "oo": oocCommand,
    "ooc": oocCommand,
    "n": narrateCommand,
    "na": narrateCommand,
    "nar": narrateCommand,
    "narrate": narrateCommand,
    "narration": narrateCommand,
    "narate": narrateCommand,
    "naratte": narrateCommand,
    "desc": storyCommand,
    "d": storyCommand,
    "story": storyCommand,
    "s": storyCommand,
    "?": helpCommand,
    "help": helpCommand,
    "h": helpCommand,
};


function spongebobCase(s) {
    let capital = true;
    return s.replaceAll(/[a-z]/gi, letter => {
        capital = !capital;
        if (capital) return letter.toUpperCase();
        else return letter.toLowerCase();
    });
}


function sendSystemMessage(message: string) {
    HandleWsMessage({
        pool: "messages",
        type: "send",
        id: GenerateId(),
        sender_id: Session.id,
        character_id: null,
        timestamp: Math.floor(new Date().getTime() / 1000),
        language: Language.COMMON,
        speaker: "System",
        content: `<div class="system">${message}</div>`,
    });
}


async function helpCommand() {
    sendSystemMessage(`
        <p><b>/?</b> display this help message</p>
        <p><b>/e</b> describe what your character is doing</p>
        <p><b>/o</b> speak out of character</p>
        <p><b>/n</b> like /e, but doesn't put your name at the front</p>
        <p><b>/r</b> roll dice</p>
        <br>
        <p><b>Examples:</b></p>
        <p>/e opens the door</p>
        <p>/n The door opens by itself</p>
        <p>/r 2d6</p>
    `);
}


async function rollCommand(formulas: string) {
    let characterId = null;
    let diceResults = "";
    const speaker = await GetSpeaker();
    if (speaker.entry_type == "character") {
        characterId = speaker.id;
    }
    for (const formula of formulas.split(",")) {
        const rollResults = Dice.Roll(formula);
        diceResults += `
            <div class="dice roll" >
                <div class="label">${formula}</div>
                <div class="result" data-category="dice" data-formula="${formula}" data-dice="${btoa(JSON.stringify(rollResults.rolls))}">${rollResults.total}</div>
            </div>
        `;
    }
    await ApiRequest("/messages/speak", {
        speaker: speaker.name,
        character_id: characterId,
        content: `
            <div class="template">
                <div class="generic-roll">
                    <div class="chat-rolls">
                        ${diceResults}
                    </div>
                </div>
            </div>
        `,
    });
}


async function memoteCommand(message) {
    const speaker = await GetSpeaker();
    await ApiRequest("/messages/speak", {
        speaker: Session.username,
        content: `
            <div class="emote">
                <img class="inline-img" src="/spongebob.png" width=36 height=36/>
                ${spongebobCase(speaker.name)} ${spongebobCase(EscapeHtml(message))}
            </div>
        `,
    });
}


async function oocCommand(message) {
    await ApiRequest("/messages/speak", {
        speaker: Session.username,
        content: `<div class="ooc">${EscapeHtml(message)}</div>`,
    });
}


async function emoteCommand(message) {
    const speaker = await GetSpeaker();
    await ApiRequest("/messages/speak", {
        speaker: Session.username,
        content: `<div class="emote">${speaker.name} ${EscapeHtml(message)}</div>`
    });
}


async function storyCommand(message) {
    await ApiRequest("/messages/speak", {
        speaker: Session.username,
        content: `<div class="story">${EscapeHtml(message)}</div>`
    });
}


async function narrateCommand(message) {
    await ApiRequest("/messages/speak", {
        speaker: Session.username,
        content: `<div class="narrate">${EscapeHtml(message)}</div>`
    });
}


async function speakCommand(message) {
    let characterId = null;
    const speaker = await GetSpeaker();
    if (speaker.entry_type == "character") {
        characterId = speaker.id;
    }
    await ApiRequest("/messages/speak", {
        speaker: speaker.name,
        character_id: characterId,
        content: `<div class="speak">${EscapeHtml(message)}</div>`,
    });
}


export class ChatWindow extends ContentWindow {
    messages: { [id: string]: HTMLDivElement };
    messageContainer: HTMLDivElement;
    inputSection: HTMLDivElement;
    textarea: HTMLTextAreaElement;

    constructor(options = undefined) {
        options = Parameter(options, {});
        options.classList = ["chat"];
        options.size = Parameter(options.size, new Vector2(400, 600));
        options.title = Parameter(options.title, "Chat");
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
                    // Check for a command pattern
                    const CMD_PATTERN = /^\s*\/([a-z0-9?_-]+)\s*/i;
                    let command = null;
                    const message = content.replace(CMD_PATTERN, (_, m) => {
                        command = m;
                        return "";
                    });
                    if (command) {
                        // Dispatch command
                        const commandFunction = COMMANDS[command];
                        if (commandFunction) {
                            try {
                                await commandFunction(message);
                            }
                            catch (error) {
                                ErrorToast(error.toString());
                            }
                        }
                        else {
                            ErrorToast(`Unknown command '${command}'`);
                        }
                    }
                    else {
                        await speakCommand(content);
                    }
                }
            }
        });

        if (Session.gm) {
            ContextMenu.set(this.viewPort, {
                "Chat Log": {
                    "Save": async () => {
                        const selection = await InputDialog("Save Chat", { "Filename": "text" }, "Save");
                        if (!selection || !selection.Filename) {
                            return;
                        }
                        await ApiRequest("/messages/save", { filename: selection.Filename });
                    },
                    "Clear": async () => {
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
                Events.dispatch("renderMessage", message);
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
            this.messageContainer.appendChild(document.createTextNode(`Error: Failed to load chat messages`));
            return;
        }

        this.setTitle(`Chat`);
        for (const message of response.messages) {
            this.addMessage(message);
        }
    }

    addMessage(message: Message) {
        if (this.messages[message.id]) {
            return null;
        }

        const element = this.messageContainer.appendChild(document.createElement("div"));
        element.className = "message";
        element.dataset.id = message.id;

        if (Session.gm) {
            ContextMenu.set(element, {
                "Message": {
                    "Edit": async () => {
                        const selection = await InputDialog("Edit Message", { "Content": ["paragraph", message.content] }, "Save");
                        if (!selection || !selection.Content) {
                            return;
                        }

                        message.content = selection.Content;
                        await ApiRequest("/messages/edit", { id: message.id, content: selection.Content });
                    },
                    "Delete": async () => {
                        await ApiRequest("/messages/delete", { id: message.id });
                    },
                },
            });
        }

        const header = element.appendChild(document.createElement("div"));
        header.className = "header"

        const speaker = header.appendChild(document.createElement("div"));
        speaker.className = "speaker";
        if (message.character_id) {
            speaker.classList.add("character");
        }
        speaker.appendChild(document.createTextNode(message.speaker));

        const messageDate = new Date(message.timestamp * 1000);
        const timestamp = header.appendChild(document.createElement("div"));
        timestamp.className = "timestamp";
        timestamp.appendChild(document.createTextNode(messageDate.toLocaleString()));

        const content = element.appendChild(document.createElement("div"));
        if (message.character_id) {
            content.classList.add("character");
        }
        content.classList.add("text");
        content.classList.add(LANGUAGES[message.language]);
        if (message.content) {
            content.classList.add("spoken");
            content.innerHTML = message.content;
        }
        else {
            const engine = DerivePcgEngine(message.id);
            content.classList.add("foreign");
            content.appendChild(document.createTextNode(
                RandomText(engine, message.length)
            ));
        }

        this.viewPort.scrollTop = this.viewPort.scrollHeight;

        this.messages[message.id] = element;
        Events.dispatch("renderMessage", element);
        return element;
    }
}
registerWindowType(ChatWindow);
