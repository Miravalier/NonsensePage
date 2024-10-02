import * as Templates from "./Templates.ts";
import { Permission } from "./Models.ts";
import { GetPermissions, ResolvePath, TitleCase } from './Utils.ts';
import { ApiRequest } from "./Requests.ts";
import { ErrorToast } from "./Notifications.ts";
import { AddDropListener } from "./Drag.ts";
import { SheetWindow } from "../windows/SheetWindow.ts";


/**
 * Base class for all entity sheets. Each ruleset will create a subclass of this
 * and register their subclass in index.ts
 */
export class Sheet {
    template: (data: any) => string;
    entryType: string;
    id: string;
    parent: SheetWindow;
    container: HTMLDivElement;
    setTriggers: { [key: string]: ((value: any) => void)[] };

    constructor(entryType: string, id: string, parent: SheetWindow) {
        this.template = null;
        this.entryType = entryType;
        this.id = id;
        this.parent = parent;
        this.container = parent.content;
        this.setTriggers = {};
    }

    /**
     * Make a full-capability update to the underlying entry
     *
     * @param changes MongoDB update, i.e. {"$set": {"name": "Bob"}}
     */
    async update(changes: any) {
        return await ApiRequest(`/${this.entryType}/update`, { id: this.id, changes });
    }

    /**
     * Make a simple key-value update to the underlying entry
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
        const response = await ApiRequest(`/${this.entryType}/get`, { id: this.id });
        if (response.status != "success") {
            ErrorToast(`${TitleCase(this.entryType)} loading failed!`);
            this.container.innerHTML = "";
            return;
        }
        await this.render(response[this.entryType]);
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
     * Triggers when the entry is rendered from scratch. Sets up all of the
     * event listeners.
     */
    onRender(data: any) {
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
     * Draw the sheet to the DOM from scratch.
     */
    async render(data: any) {
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
    async init(data: any) {
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
            new(entryType: string, id: string, parent: SheetWindow): Sheet
        },
        html: string
    }
} = {};


export function RegisterSheet(identifier: string, type: { new(entryType: string, id: string, parent: SheetWindow): Sheet }, html: string) {
    SheetRegistry[type.name] = { type, html };
    SheetRegistry[identifier] = { type, html };
}


RegisterSheet("character.default", Sheet, "");
RegisterSheet("ability.default", Sheet, "");
