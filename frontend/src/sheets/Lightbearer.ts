import { Character } from "../lib/models.ts";
import { RegisterSheet, Sheet } from "./sheet.ts";
import LightbearerHtml from "./Lightbearer.html?raw";
import LightbearerCss from "./Lightbearer.css?raw";


export class LightbearerSheet extends Sheet {
    constructor(character: Character) {
        super(character);
        this.templatePath = LightbearerHtml;
        this.cssPath = LightbearerCss;
    }
}
RegisterSheet(LightbearerSheet);
