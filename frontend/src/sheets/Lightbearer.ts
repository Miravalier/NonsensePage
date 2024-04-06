import { RegisterSheet, Sheet } from "./sheet.ts";
import { CharacterSheetWindow } from "../windows/character_sheet_window.ts";
import LightbearerHtml from "./Lightbearer.html?raw";
import LightbearerCss from "./Lightbearer.css?raw";


export class LightbearerSheet extends Sheet {
    constructor(characterId: string, parent: CharacterSheetWindow) {
        super(characterId, parent);
        this.templateString = LightbearerHtml;
        this.cssString = LightbearerCss;
    }
}
RegisterSheet(LightbearerSheet);
