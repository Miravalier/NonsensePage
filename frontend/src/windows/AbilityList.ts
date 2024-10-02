import { registerWindowType } from "./Window.ts";
import { EntryListWindow } from "./EntryList.ts";
import { AbilitySheetWindow } from "./AbilitySheetWindow.ts";
import { Parameter } from "../lib/Utils.ts";


export class AbilityListWindow extends EntryListWindow {
    constructor(options = undefined) {
        options = Parameter(options, {});
        options.classList = ["ability-list"];
        options.entryType = "ability";
        super(options);
    }

    async openEntryHandler(id: string) {
        const abilityWindow = new AbilitySheetWindow({
            title: "Ability",
        });
        await abilityWindow.load(id);
    }
}

registerWindowType(AbilityListWindow);
