import { registerWindowType } from "./Window.ts";
import { Vector2 } from "../lib/Vector.ts";
import { Parameter } from "../lib/Utils.ts";
import { SheetWindow } from "./SheetWindow.ts";


export class CharacterSheetWindow extends SheetWindow {
    constructor(options = undefined) {
        options = Parameter(options, {});
        options.classList = ["character"];
        options.size = Parameter(options.size, new Vector2(540, 600));
        options.entryType = "character";
        super(options);
    }
}
registerWindowType(CharacterSheetWindow);
