import * as Templates from "./Templates.ts";
import { Character, Permission } from "./Models.ts";
import { GetPermissions, ResolvePath } from './Utils.ts';
import { ApiRequest } from "./Requests.ts";
import { ErrorToast } from "./Notifications.ts";
import { CharacterSheetWindow } from "../windows/CharacterSheet.ts";
import { AddDropListener } from "./Drag.ts";


/**
 * Base class for all character sheets. Each ruleset will create a subclass of this
 * and register their subclass in index.ts
 */
export class Sheet {
    template: (data: any) => string;
    characterId: string;
    parent: CharacterSheetWindow;
    container: HTMLDivElement;
    setTriggers: { [key: string]: ((value: any) => void)[] };

    constructor(characterId: string, parent: CharacterSheetWindow) {
        this.template = null;
        this.characterId = characterId;
        this.parent = parent;
        this.container = parent.content;
        this.setTriggers = {};
    }

    /**
     * Make a full-capability update to the underlying character
     *
     * @param changes MongoDB update, i.e. {"$set": {"name": "Bob"}}
     */
    async update(changes: any) {
        return await ApiRequest("/character/update", { id: this.characterId, changes });
    }

    /**
     * Make a simple key-value update to the underlying character
     */
    async set(key: string, value: any) {
        this.onSet(key, value);
        return await this.update({ "$set": { [key]: value } });
    }

    /**
     * Triggers when an update comes in
     *
     * @param changes MongoDB update, i.e. {"$set": {"name": "Bob"}}
     */
    async onUpdate(changes: any) {
        // Check if the changes can be made without a re-render
        if (changes["$set"] && Object.keys(changes).length == 1) {
            for (const [key, value] of Object.entries(changes["$set"])) {
                await this.onSet(key, value);
            }
            return;
        }
        // Re-render everything
        const response: {
            status: string;
            character: Character;
        } = await ApiRequest("/character/get", { id: this.characterId });
        if (response.status != "success") {
            ErrorToast("Character loading failed!");
            this.container.innerHTML = "";
            return;
        }
        await this.render(response.character);
    }

    /**
     * Triggers when an update comes in with simple $set data. Dispatches
     * each callback registered with the particular key that was changed
     */
    async onSet(key: string, value: any) {
        if (key == "name") {
            this.parent.setTitle(value);
        }
        let triggerArray = this.setTriggers[key];
        if (triggerArray) {
            for (const trigger of triggerArray) {
                trigger(value);
            }
        }
    }

    /**
     * Add a trigger to be called when the given key changes via a set operation
     *
     * All triggers should be idempotent, events may be delivered multiple times
     */
    addTrigger(key: string, trigger: (value: any) => void) {
        let triggerArray = this.setTriggers[key]
        if (!triggerArray) {
            triggerArray = [];
            this.setTriggers[key] = triggerArray;
        }
        triggerArray.push(trigger);
    }

    /**
     * Triggers when the character is rendered from scratch. Sets up all of the
     * event listeners.
     */
    onRender(data: Character) {
        this.setTriggers = {};
        const permission = GetPermissions(data);
        if (permission == Permission.Read) {
            for (const inputElement of this.container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea")) {
                inputElement.disabled = true;
            }
        }

        for (const inputElement of this.container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea")) {
            if (!inputElement.dataset.attr) {
                continue;
            }
            inputElement.value = ResolvePath(data, inputElement.dataset.attr);
            inputElement.addEventListener("change", async () => {
                await this.set(inputElement.dataset.attr, inputElement.value);
            });
            this.addTrigger(inputElement.dataset.attr, (value) => {
                inputElement.value = value;
            });
        }
        for (const imageElement of this.container.querySelectorAll<HTMLImageElement>("img")) {
            if (!imageElement.dataset.attr) {
                continue;
            }
            imageElement.src = ResolvePath(data, imageElement.dataset.attr);
            AddDropListener(imageElement, async (dropData) => {
                if (dropData.type != "file") {
                    return;
                }
                await this.set(imageElement.dataset.attr, dropData.urlPath);
            });
            this.addTrigger(imageElement.dataset.attr, (value) => {
                imageElement.src = value;
            });
        }
    }

    /**
     * Draw the character sheet to the DOM from scratch.
     */
    async render(data: Character) {
        data.helperData = { sheet: this, fragmentCallbacks: [] };
        const html = this.template(data);
        this.container.innerHTML = html;
        for (const callback of data.helperData.fragmentCallbacks) {
            callback(this.container, data);
        }
        this.onRender(data);
    }

    /**
     * Called exactly once, after the constructor. Loads the async resources
     * associated with this sheet, then renders it.
     */
    async init(data: Character) {
        this.container.classList.add("sheet");
        const { html } = SheetRegistry[this.constructor.name];
        this.template = Templates.LoadTemplate(this.constructor.name, html);
        await this.render(data);
    }
}


export const SheetRegistry: {
    [name: string]:
    {
        type: {
            new(characterId: string, parent: CharacterSheetWindow): Sheet
        },
        html: string
    }
} = { default: { type: Sheet, html: "" } };


export function RegisterSheet(type: { new(characterId: string, parent: CharacterSheetWindow): Sheet }, html: string) {
    SheetRegistry[type.name] = { type, html };
}

export function RegisterDefaultSheet(type: { new(characterId: string, parent: CharacterSheetWindow): Sheet }, html: string) {
    SheetRegistry[type.name] = { type, html };
    SheetRegistry.default = SheetRegistry[type.name];
}
