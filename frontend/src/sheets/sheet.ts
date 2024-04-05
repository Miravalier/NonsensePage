import * as Templates from "../lib/templates.ts";
import * as Sqrl from 'squirrelly';
import { TemplateFunction } from "squirrelly/dist/types/compile";
import { Character } from "../lib/models.ts";


export const SheetTypes: { [name: string]: { new(character: Character): Sheet } } = {};


export class Sheet {
    templatePath: string;
    cssPath: string;
    character: Character;
    template: TemplateFunction;
    container: HTMLDivElement;

    constructor(character: Character) {
        this.templatePath = null;
        this.cssPath = null;
        this.template = null;
        this.character = character;
    }

    /**
     * @param changes MongoDB insert command, i.e. {"$set": {"name": "Bob"}}
     */
    update(changes: any) {
        // Check if the changes can be made without a re-render
        if (changes !== null && changes["$set"] && Object.keys(changes).length == 1) {
            let simpleChanges = true;

            for (const [key, value] of Object.entries(changes["$set"])) {
                console.log("Character Change:", key, value);
                simpleChanges = false;
            }

            if (simpleChanges) {
                return;
            }
        }
        // Re-render everything
        const html = this.template(this.character, Sqrl.getConfig({ useWith: true }));
        this.container.innerHTML = html;
        this.addListeners();
    }

    addListeners() {
        for (const inputElement of this.container.querySelectorAll<HTMLInputElement>("input")) {
            console.log(inputElement);
        }
    }

    async render(container: HTMLDivElement) {
        this.container = container;
        if (this.cssPath !== null) {
            await Templates.loadCss(this.cssPath);
        }
        if (this.templatePath !== null) {
            this.template = await Templates.loadTemplate(this.templatePath);
        }
        this.update(null);
    }
}


export function RegisterSheet(type: { new(character: Character): Sheet }) {
    SheetTypes[type.name] = type;
}
