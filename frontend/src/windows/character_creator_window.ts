import { Vector2 } from "../lib/vector.ts";
import { ContentWindow, registerWindowType } from "./window.ts";
import { Parameter } from "../lib/utils.ts";
import * as Fragments from "../fragments/fragment.ts";


export class CharacterCreatorWindow extends ContentWindow {
    constructor(options) {
        options.classList = ["character-creator"];
        options.size = Parameter(options.size, new Vector2(600, 600));
        options.title = Parameter(options.title, "Character Creation");
        super(options);
        Fragments.RenderFragment(this.content, "lightbearer_cc", { window: this });
    }
}
registerWindowType(CharacterCreatorWindow);
