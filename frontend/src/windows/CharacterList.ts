import { registerWindowType } from "./Window.ts";
import { CharacterSheetWindow } from "./CharacterSheet.ts";
import { EntryListWindow } from "./EntryList.ts";
import { ApiRequest, Session } from "../lib/Requests.ts";
import { Parameter } from "../lib/Utils.ts";


export class CharacterListWindow extends EntryListWindow {
    constructor(options = undefined) {
        options = Parameter(options, {});
        options.classList = ["character-list"];
        options.entryType = "character";
        super(options);
    }

    async openEntryHandler(id: string) {
        const characterSheetWindow = new CharacterSheetWindow({
            title: "Character Sheet",
        });
        console.log("DEBUG Character Sheet Window Loading:", id);
        await characterSheetWindow.load(id);
    }

    async contextMenuHook(id: string, contextOptions: { [choice: string]: (ev: MouseEvent) => void }) {
        if (Session.gm) {
            contextOptions["Control"] = async () => {
                await ApiRequest("/user/update", {
                    id: Session.id,
                    changes: { "$set": { "character_id": id } },
                });
            };
        }
    }
}

registerWindowType(CharacterListWindow);
