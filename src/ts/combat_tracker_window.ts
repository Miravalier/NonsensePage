import * as ContextMenu from "./contextmenu.js";
import { Vector2 } from "./vector.js";
import { CharacterSheetWindow } from "./character_sheet_window.js";
import { ConfirmDialog, ContentWindow, InputDialog, registerWindowType } from "./window.js";
import { ApiRequest, Session } from "./requests.js";
import { Parameter, HasPermission } from "./utils.js";
import { ErrorToast } from "./notifications.js";
import { Html } from "./elements.js";
import { Roll } from "./dice.js";
import { Permissions } from "./enums.js";


export class CombatTrackerWindow extends ContentWindow {
    constructor(options) {
        options.classList = ["combat-tracker"];
        options.size = Parameter(options.size, new Vector2(380, 520));
        options.title = Parameter(options.title, "Combat Tracker");
        super(options);
        this.combatId = null;
        this.dropListener = false;
        this.combatantContainer = this.content.appendChild(Html(`
            <div class="combatants">
            </div>
        `));
        this.combatantElements = {};
        this.combatantIndexes = {};
        const buttonContainer = this.content.appendChild(Html(`
            <div class="buttons"></div>
        `));

        if (Session.gm) {
            const announceButton = buttonContainer.appendChild(Html(`
                <button type="button" class="announce">Announce</button>
            `));
            announceButton.addEventListener("click", async (ev) => {
                await ApiRequest("/combat/announce-turn", {
                    id: this.combatId,
                });
            });

            const reverseButton = buttonContainer.appendChild(Html(`
                <button type="button" class="reverse-turn">◀</button>
            `));
            reverseButton.addEventListener("click", async (ev) => {
                await ApiRequest("/combat/reverse-turn", {
                    id: this.combatId,
                });
            });
        }

        this.endTurnButton = buttonContainer.appendChild(Html(`
            <button type="button" class="end-turn">End Turn ▶</button>
        `));
        this.endTurnButton.addEventListener("click", async (ev) => {
            await ApiRequest("/combat/end-turn", {
                id: this.combatId,
            });
        });

        if (Session.gm) {
            const sortButton = buttonContainer.appendChild(Html(`
                <button type="button" class="sort">Sort</button>
            `));
            sortButton.addEventListener("click", async (ev) => {
                await ApiRequest("/combat/sort", {
                    id: this.combatId,
                });
            });

            const clearButton = buttonContainer.appendChild(Html(`
                <button type="button" class="clear">Clear</button>
            `));
            clearButton.addEventListener("click", async (ev) => {
                if (!await ConfirmDialog("Clear the combat tracker?")) {
                    return;
                }
                await ApiRequest("/combat/clear", {
                    id: this.combatId,
                });
            });
        }
    }

    AddCombatant(index, combatant) {
        this.combatantIndexes[combatant.id] = index;
        let initiative = combatant.initiative;
        if (initiative === null || initiative === undefined) {
            initiative = "";
        }
        let combatantElement = this.combatantElements[combatant.id];
        if (combatantElement) {
            this.combatantContainer.appendChild(combatantElement);
            combatantElement.querySelector(".name").textContent = combatant.name;
            combatantElement.querySelector(".initiative").textContent = initiative;
        }
        else {
            combatantElement = this.combatantContainer.appendChild(Html(`
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
            if (Session.gm) {
                ContextMenu.set(combatantElement, {
                    "Edit Combatant": {
                        "Rename": async (ev) => {
                            const selection = await InputDialog("Rename Combatant", { "Name": "text" }, "Finish");
                            if (!selection || !selection.Name) {
                                return;
                            }
                            await ApiRequest("/combat/update", {
                                id: this.combatId,
                                changes: {
                                    "$set": {
                                        [`combatants.${this.combatantIndexes[combatant.id]}.name`]: selection.Name
                                    },
                                },
                            });
                        },
                        "Delete Combatant": async (ev) => {
                            await ApiRequest("/combat/update", {
                                id: this.combatId,
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
                                id: this.combatId,
                                changes: {
                                    "$set": {
                                        [`combatants.${this.combatantIndexes[combatant.id]}.initiative`]: Roll("2d6").total
                                    },
                                },
                            });
                        },
                        "Set Initiative": async (ev) => {
                            const selection = await InputDialog("Set Initiative", { "Initiative": "number" }, "Set");
                            if (!selection || !selection.Initiative) {
                                return;
                            }
                            await ApiRequest("/combat/update", {
                                id: this.combatId,
                                changes: {
                                    "$set": {
                                        [`combatants.${this.combatantIndexes[combatant.id]}.initiative`]: selection.Initiative
                                    }
                                },
                            });
                        },
                        "Clear Initiative": async (ev) => {
                            await ApiRequest("/combat/update", {
                                id: this.combatId,
                                changes: {
                                    "$set": {
                                        [`combatants.${this.combatantIndexes[combatant.id]}.initiative`]: null
                                    }
                                },
                            });
                        },
                    }
                });
            }
            this.combatantElements[combatant.id] = combatantElement;
        }
    }

    async load(id) {
        await super.load();
        this.setTitle("Combat Tracker");

        let combat;
        if (id) {
            let response = await ApiRequest("/combat/get", { id });
            combat = response.combat;
        }
        else if (this.combatId) {
            let response = await ApiRequest("/combat/get", { id: this.combatId });
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
        this.combatId = combat.id;

        // Use response
        const combatantIds = new Set();
        for (let i = 0; i < combat.combatants.length; i++) {
            const combatant = combat.combatants[i];
            this.AddCombatant(i, combatant);
            combatantIds.add(combatant.id);
        }

        for (let [id, combatantElement] of Object.entries(this.combatantElements)) {
            if (!combatantIds.has(id)) {
                combatantElement.remove();
                delete this.combatantElements[id];
                delete this.combatantIndexes[id];
            }
        }

        if (combat.combatants.length > 0) {
            const currentCombatant = combat.combatants[0];
            if (HasPermission(currentCombatant, Session.id, "*", Permissions.WRITE)) {
                this.endTurnButton.style.display = null;
            }
            else {
                this.endTurnButton.style.display = 'none';
            }
        }

        // Set up update watcher
        await this.subscribe(combat.id, async updateData => {
            this.refresh();
        });

        this.addDropListener(this.viewPort, async (data) => {
            if (data.type != "character") {
                return false;
            }
            await ApiRequest("/combat/add-combatant", {
                combat_id: combat.id,
                character_id: data.id,
            });
        });
    }

    serialize() {
        return {combatId: this.combatId};
    }

    async deserialize(data) {
        await this.load(data.combatId);
    }
}
registerWindowType(CombatTrackerWindow);
