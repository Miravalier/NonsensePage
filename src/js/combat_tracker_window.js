import * as ContextMenu from "./contextmenu.js";
import { Vector2 } from "./vector.js";
import { CharacterSheetWindow } from "./character_sheet_window.js";
import { ContentWindow, Dialog } from "./window.js";
import { ApiRequest } from "./requests.js";
import { Parameter } from "./utils.js";
import { ErrorToast } from "./notifications.js";
import { Html } from "./elements.js";
import { Roll } from "./dice.js";


export class CombatTrackerWindow extends ContentWindow {
    constructor(options) {
        options.classList = ["combat-tracker"];
        options.size = Parameter(options.size, new Vector2(380, 520));
        super(options);
        this.id = null;
        this.dropListener = false;
        this.combatants = [];
    }

    AddCombatant(index, combatant) {
        let initiative = combatant.initiative;
        if (initiative === null || initiative === undefined) {
            initiative = "";
        }
        const combatantElement = this.combatantContainer.appendChild(Html(`
            <div class="combatant" data-id="${combatant.id}">
                <span class="name">${combatant.name}</span>
                <span class="initiative">${initiative}</span>
            </div>
        `));
        combatantElement.addEventListener("click", async () => {
            const characterSheetWindow = new CharacterSheetWindow({
                title: "Character Sheet",
            });
            await characterSheetWindow.load(combatant.character_id);
        });
        ContextMenu.set(combatantElement, {
            "Edit Combatant": {
                "Delete Combatant": async (ev) => {
                    await ApiRequest("/combat/update", {
                        id: this.id,
                        changes: {
                            "$pull": {
                                combatants: {
                                    id: combatant.id,
                                },
                            },
                        },
                    });
                },
                "Roll Initiative": async (ev) => {
                    await ApiRequest("/combat/update", {
                        id: this.id,
                        changes: {
                            "$set": {
                                [`combatants.${index}.initiative`]: Roll("2d6").total
                            }
                        },
                    });
                },
                "Set Initiative": async (ev) => {
                    const initiativeInput = document.createElement("input");
                    initiativeInput.type = "number";
                    initiativeInput.maxLength = 128;

                    const setButton = document.createElement("button");
                    setButton.appendChild(document.createTextNode("Set"));

                    const cancelButton = document.createElement("button");
                    cancelButton.appendChild(document.createTextNode("Cancel"));

                    const dialog = new Dialog({
                        title: "Set Initiative",
                        elements: [
                            initiativeInput,
                            [setButton, cancelButton]
                        ]
                    });

                    setButton.addEventListener("click", async () => {
                        const initiative = parseInt(initiativeInput.value);
                        await ApiRequest("/combat/update", {
                            id: this.id,
                            changes: {
                                "$set": {
                                    [`combatants.${index}.initiative`]: initiative
                                }
                            },
                        });
                        dialog.close();
                    });

                    cancelButton.addEventListener("click", () => {
                        dialog.close();
                    });

                },
                "Clear Initiative": async (ev) => {
                    await ApiRequest("/combat/update", {
                        id: this.id,
                        changes: {
                            "$set": {
                                [`combatants.${index}.initiative`]: null
                            }
                        },
                    });
                },
            }
        });
    }

    async load(id) {
        await super.load();
        this.content.innerHTML = "";
        this.setTitle("Combat Tracker");

        let combat;
        if (id) {
            let response = await ApiRequest("/combat/get", { id });
            combat = response.combat;
        }
        else if (this.id) {
            let response = await ApiRequest("/combat/get", { id: this.id });
            combat = response.combat;
        }
        else {
            let response = await ApiRequest("/combat/list");
            if (response.status != "success") {
                ErrorToast(`Combat tracker failed to load.`);
                this.close();
                return;
            }

            if (response.combats.length > 0) {
                combat = response.combats[0];
            }
            else {
                response = await ApiRequest("/combat/create", { name: "New Combat" });
                if (response.status != "success") {
                    ErrorToast(`Combat tracker failed to create.`);
                    this.close();
                    return;
                }
                combat = response.combat;
            }
        }
        this.id = combat.id;

        this.combatantContainer = this.content.appendChild(Html(`
            <div class="combatants">
            </div>
        `));

        // Use response
        this.combatants = combat.combatants;
        for (let i = 0; i < combat.combatants.length; i++) {
            const combatant = combat.combatants[i];
            this.AddCombatant(i, combatant);
        }

        // Set up update watcher
        await this.subscribe(combat.id, async updateData => {
            this.refresh();
        });

        this.addDropListener(this.viewPort, async (data) => {
            if (data.type != "character") {
                return false;
            }
            console.log(`Adding character id '${data.id}' to the Combat Tracker`);
            await ApiRequest("/combat/add-combatant", {
                combat_id: combat.id,
                character_id: data.id,
            });
        });

        const endTurnButton = this.content.appendChild(Html(`
            <button type="button" class="end-turn">End Turn</button>
        `));
        endTurnButton.addEventListener("click", async (ev) => {
            await ApiRequest("/combat/end-turn", {
                id: combat.id,
            })
        });
    }
}
