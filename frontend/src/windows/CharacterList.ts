import { registerWindowType } from "./Window.ts";
import { CharacterSheetWindow } from "./CharacterSheet.ts";
import { EntryListWindow } from "./EntryList.ts";


export class CharacterListWindow extends EntryListWindow {
    constructor(options) {
        options.classList = ["character-list"];
        options.entryType = "character";
        super(options);
    }

    async openEntryHandler(id: string) {
        const characterSheetWindow = new CharacterSheetWindow({
            title: "Character Sheet",
        });
        await characterSheetWindow.load(id);
    }
}

registerWindowType(CharacterListWindow);
