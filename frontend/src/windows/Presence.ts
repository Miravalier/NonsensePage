import { InvisibleWindow, registerWindowType } from "./Window.ts";
import { Vector2 } from "../lib/Vector.ts";
import { Parameter } from "../lib/Utils.ts";


export class PresenceWindow extends InvisibleWindow {

    constructor(options = undefined) {
        options = Parameter(options, {});
        options.classList = ["presence"];
        options.size = Parameter(options.size, new Vector2(380, 520));
        options.title = Parameter(options.title, "Presence");
        super(options);
    }

    async load(_data = undefined) {
        await super.load();
        this.content.innerHTML = "<span>Not yet implemented!</span>";
    }
}


registerWindowType(PresenceWindow);
