import * as Templates from "./Templates.ts";
import { Permission } from "./Models.ts";
import { GetPermissions, ApplyChanges, ResolvePath } from './Utils.ts';
import { ApiRequest } from "./Requests.ts";
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
    data: any;

    constructor(entryType: string, id: string, parent: SheetWindow) {
        this.template = null;
        this.entryType = entryType;
        this.id = id;
        this.parent = parent;
        this.container = parent.content;
        this.setTriggers = {};
        this.data = null;
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
        return await this.update({ "$set": { [key]: value } });
    }

    /**
     * Triggers when an update comes in
     *
     * @param changes MongoDB update, i.e. {"$set": {"name": "Bob"}}
     */
    async onUpdate(changes: any) {
        ApplyChanges(this.data, changes, (event: string, key: string, value: any) => {
            this.onTrigger(event, key, value);
        });
    }

    /**
     * Dispatches all callbacks registered with a particular event and key
     *
     * @returns true if at least 1 callback was dispatched
     */
    onTrigger(event: string, key: string, value: any): boolean {
        if (key == "name") {
            this.parent.setTitle(value);
        }
        let triggerArray = this.setTriggers[`${event}:${key}`];
        if (!triggerArray || triggerArray.length == 0) {
            return false;
        }

        for (const trigger of triggerArray) {
            trigger(value);
        }
        return true;
    }

    /**
     * Add a trigger to be called when the given key changes via a set operation
     *
     * All triggers should be idempotent, events may be delivered multiple times
     */
    addTrigger(event: string, key: string, trigger: (value: any) => void) {
        let triggerArray = this.setTriggers[`${event}:${key}`]
        if (!triggerArray) {
            triggerArray = [];
            this.setTriggers[`${event}:${key}`] = triggerArray;
        }
        triggerArray.push(trigger);
    }

    /**
     * Triggers when the entry is rendered from scratch. Sets up all of the
     * event listeners.
     */
    onRender() {
        this.setTriggers = {};
        const permission = GetPermissions(this.data);
        if (permission == Permission.Read) {
            for (const inputElement of this.container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea")) {
                inputElement.disabled = true;
            }
        }

        for (const inputElement of this.container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea")) {
            if (!inputElement.dataset.attr) {
                continue;
            }
            inputElement.value = ResolvePath(this.data, inputElement.dataset.attr);
            inputElement.addEventListener("change", async () => {
                if (inputElement.type == "number") {
                    await this.set(inputElement.dataset.attr, parseFloat(inputElement.value));
                }
                else {
                    await this.set(inputElement.dataset.attr, inputElement.value);
                }
            });
            this.addTrigger("set", inputElement.dataset.attr, (value) => {
                inputElement.value = value;
            });
        }
        for (const imageElement of this.container.querySelectorAll<HTMLImageElement>("img")) {
            if (!imageElement.dataset.attr) {
                continue;
            }
            imageElement.src = ResolvePath(this.data, imageElement.dataset.attr);
            AddDropListener(imageElement, async (dropData) => {
                if (dropData.type != "file") {
                    return;
                }
                await this.set(imageElement.dataset.attr, dropData.urlPath);
            });
            this.addTrigger("set", imageElement.dataset.attr, (value) => {
                imageElement.src = value;
            });
        }
    }

    /**
     * Draw the sheet to the DOM from scratch.
     */
    async render() {
        this.data.helperData = { sheet: this, fragmentCallbacks: [] };
        const html = this.template(this.data);
        this.container.innerHTML = html;
        for (const callback of this.data.helperData.fragmentCallbacks) {
            callback(this.container, this.data);
        }
        this.onRender();
    }

    /**
     * Called exactly once, after the constructor. Loads the async resources
     * associated with this sheet, then renders it.
     */
    async init(data: any) {
        this.data = data;
        this.container.classList.add("sheet");
        const { html } = SheetRegistry[this.constructor.name];
        this.template = Templates.LoadTemplate(this.constructor.name, html);
        await this.render();
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
