import { AddCharacterUpdate } from "./pending_updates.js";
import { ApiRequest } from "./requests.js";
import { AddDropListener } from "./utils.js";

export class Sheet {
    constructor(id, window) {
        this.id = id;
        this.window = window;
        this.inputs = {};
        this.images = {};
    }

    registerBatchedInput(selector, key) {
        /** @type {HTMLInputElement} */
        const element = this.window.content.querySelector(selector);
        if (!element) {
            console.error(`Can't find "${selector}" in character sheet`);
            return null;
        }
        element.addEventListener("input", async () => {
            AddCharacterUpdate(this.id, { [key]: element.value });
        });
        this.inputs[key] = element;
        return element;
    }

    registerInput(selector, key) {
        /** @type {HTMLInputElement} */
        const element = this.window.content.querySelector(selector);
        if (!element) {
            console.error(`Can't find "${selector}" in character sheet`);
            return null;
        }
        element.addEventListener("input", async () => {
            const update = {
                id: this.id,
                changes: {
                    [key]: element.value,
                }
            };
            await ApiRequest("/character/update", update);
        });
        this.inputs[key] = element;
        return element;
    }

    registerImageInput(selector, key) {
        /** @type {HTMLImageElement} */
        const element = this.window.content.querySelector(selector);
        if (!element) {
            console.error(`Can't find "${selector}" in character sheet`);
            return;
        }
        AddDropListener(element, async (data) => {
            if (data.type != "file") {
                return;
            }
            const update = {
                id: this.id,
                changes: {
                    [key]: data.path,
                }
            };
            await ApiRequest("/character/update", update);
        });
        this.images[key] = element;
        return element;
    }

    addListeners() {
    }

    update(changes) {
        if (changes.name) {
            this.window.titleNode.textContent = changes.name;
        }
        for (const [key, value] of Object.entries(changes)) {
            if (this.inputs[key]) {
                this.inputs[key].value = value;
            }
            else if (this.images[key]) {
                this.images[key].src = value;
            }
        }
    }
}
