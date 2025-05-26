import { InputDialog, registerWindowType } from "./Window.ts";
import { EntryListWindow } from "./EntryList.ts";
import { AbilitySheetWindow } from "./AbilitySheet.ts";
import { Parameter } from "../lib/Utils.ts";
import { ApiRequest } from "../lib/Requests.ts";
import { Ability, CharacterAbility } from "../lib/Models.ts";
import { ErrorToast } from "../lib/Notifications.ts";
import { Session } from "../lib/Requests.ts";


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

    async onDrop(folderId: string, dropData: any) {
        await super.onDrop(folderId, dropData);
        if (dropData.type == this.entryType) {
            const createResponse = await ApiRequest(`/${this.entryType}/create`, {
                name: dropData[this.entryType].name,
                folder_id: this.folderId,
            });
            if (createResponse.status !== "success") {
                ErrorToast(`Failed to create ${this.entryType}`);
                return;
            }
            const ability = dropData.ability as Ability | CharacterAbility;
            await ApiRequest(`/${this.entryType}/update`, {
                id: createResponse.id,
                changes: {
                    "$set": {
                        cooldown: ability.cooldown,
                        description: ability.description,
                        image: ability.image,
                        rolls: ability.rolls,
                        type: ability.type,
                    }
                },
            });
        }
    }

    async contextMenuHook(type: string, id: string, contextOptions: { [choice: string]: (ev: MouseEvent) => void }) {
        if (type == "folder" && Session.gm) {
            contextOptions["Set Alt-Id"] = async () => {
                const selection = await InputDialog(`Set Alternate Id`, { "ID": ["text"] }, "Set");
                if (!selection || !selection.ID) {
                    return;
                }

                await ApiRequest("/folder/ability/alt-id", {
                    folder_id: id,
                    alternate_id: selection.ID,
                });
            };
        }
    }
}

registerWindowType(AbilityListWindow);
