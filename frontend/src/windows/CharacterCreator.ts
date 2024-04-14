import { Vector2 } from "../lib/Vector.ts";
import { ContentWindow, registerWindowType } from "./Window.ts";
import { Parameter } from "../lib/Utils.ts";
import { IntroRegistry } from "../lib/Intro.ts";
import { LoadTemplate } from "../lib/Templates.ts";


export class CharacterCreatorWindow extends ContentWindow {
    constructor(options) {
        options.classList = ["character-creator"];
        options.size = Parameter(options.size, new Vector2(600, 600));
        options.title = Parameter(options.title, "Character Creation");
        super(options);
        const { html, callback } = IntroRegistry;
        const template = LoadTemplate("intro", html);
        const data = { window: this };
        this.content.innerHTML = template(data);
        callback(this.content, data);
    }
}
registerWindowType(CharacterCreatorWindow);
