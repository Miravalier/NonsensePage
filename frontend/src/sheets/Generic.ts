import { Character } from "../lib/models.ts";
import { RegisterSheet, Sheet } from "./sheet.ts";
import GenericHtml from "./Generic.html?raw";
import GenericCss from "./Generic.css?raw";


export class GenericSheet extends Sheet {
    constructor(character: Character) {
        super(character);
        this.templatePath = GenericHtml;
        this.cssPath = GenericCss;
    }
}
RegisterSheet(GenericSheet);
