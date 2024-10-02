import { registerWindowType } from "./Window.ts";
import { EntryListWindow } from "./EntryList.ts";
import { NoteWindow } from "./NoteWindow.ts";
import { Parameter } from "../lib/Utils.ts";


export class AbilityListWindow extends EntryListWindow {
    constructor(options = undefined) {
        options = Parameter(options, {});
        options.classList = ["ability-list"];
        options.entryType = "ability";
        super(options);
    }

    async openEntryHandler(id: string) {
        const noteWindow = new NoteWindow({
            title: "Ability",
        });
        await noteWindow.load(id);
    }
}

registerWindowType(AbilityListWindow);
