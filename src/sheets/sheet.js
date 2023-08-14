import { AddCharacterUpdate } from "./pending_updates.js";
import { ApiRequest } from "./requests.js";
import { AddDropListener, ContainsOperators, ResolvePath } from "./utils.js";

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
            await ApiRequest("/character/update", {
                id: this.id,
                changes: {
                    "$set": {
                        [key]: element.value,
                    }
                }
            });
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
            await ApiRequest("/character/update", {
                id: this.id,
                changes: {
                    "$set": {
                        [key]: data.path,
                    }
                }
            });
        });
        this.images[key] = element;
        return element;
    }

    addListeners() {
    }

    onLoad(data) {
    }

    update(changes) {
        if (Object.keys(changes).length == 1 && changes["$set"]) {
            changes = changes["$set"];
        }
        if (ContainsOperators(changes)) {
            this.window.load(this.id);
            return;
        }

        if (changes.name) {
            this.window.setTitle(changes.name);
        }

        for (const [key, element] of Object.entries(this.images)) {
            const value = ResolvePath(changes, key);
            if (value !== undefined) {
                if (value) {
                    element.src = value;
                }
                else {
                    element.src = "/unknown.png";
                }
            }
        }

        for (const [key, element] of Object.entries(this.inputs)) {
            const value = ResolvePath(changes, key);
            if (value !== undefined) {
                element.value = value;
            }
        }
    }
}
