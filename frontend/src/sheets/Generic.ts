import { RegisterSheet, Sheet } from "./sheet.ts";
import { CharacterSheetWindow } from "../windows/character_sheet_window.ts";
import GenericHtml from "./Generic.html?raw";
import GenericCss from "./Generic.css?raw";


export class GenericSheet extends Sheet {
    constructor(characterId: string, parent: CharacterSheetWindow) {
        super(characterId, parent);
        this.templateString = GenericHtml;
        this.cssString = GenericCss;
    }
}
RegisterSheet(GenericSheet);
