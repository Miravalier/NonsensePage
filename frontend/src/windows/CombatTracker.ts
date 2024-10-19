import * as ContextMenu from "../lib/ContextMenu.ts";
import { Vector2 } from "../lib/Vector.ts";
import { CharacterSheetWindow } from "./CharacterSheet.ts";
import { ConfirmDialog, ContentWindow, InputDialog, registerWindowType } from "./Window.ts";
import { ApiRequest, Session } from "../lib/Requests.ts";
import { Parameter, HasPermission } from "../lib/Utils.ts";
import { ErrorToast } from "../lib/Notifications.ts";
import { Html } from "../lib/Elements.ts";
import { Roll } from "../lib/Dice.ts";
import { Permissions } from "../lib/Enums.ts";
import { Character, Combat, Combatant } from "../lib/Models.ts";
import { GetSetting, ResolveCharacter } from "../lib/Database.ts";


export class CombatTrackerWindow extends ContentWindow {
    combatId: string;
    combatantContainer: HTMLDivElement;
    combatantElements: { [id: string]: HTMLDivElement };
    combatantIndexes: { [id: string]: number };
    endTurnButton: HTMLButtonElement;

    constructor(options = undefined) {
        options = Parameter(options, {});
        options.classList = ["combat-tracker"];
        options.size = Parameter(options.size, new Vector2(380, 520));
        options.title = Parameter(options.title, "Combat Tracker");
        super(options);
        this.combatId = null;
        this.combatantContainer = this.content.appendChild(Html(`
            <div class="combatants">
            </div>
        `) as HTMLDivElement);
        this.combatantElements = {};
        this.combatantIndexes = {};
        const buttonContainer = this.content.appendChild(Html(`
            <div class="buttons"></div>
        `));

        if (Session.gm) {
            const announceButton = buttonContainer.appendChild(Html(`
                <button type="button" class="announce"><i class="fa-solid fa-megaphone"></i></button>
            `) as HTMLButtonElement);
            announceButton.addEventListener("click", async () => {
                await ApiRequest("/combat/announce-turn", {
                    id: this.combatId,
                });
            });

            const reverseButton = buttonContainer.appendChild(Html(`
                <button type="button" class="reverse-turn">◀</button>
            `) as HTMLButtonElement);
            reverseButton.addEventListener("click", async () => {
                await ApiRequest("/combat/reverse-turn", {
                    id: this.combatId,
                });
            });
        }

        this.endTurnButton = buttonContainer.appendChild(Html(`
            <button type="button" class="end-turn">End Turn ▶</button>
        `) as HTMLButtonElement);
        this.endTurnButton.addEventListener("click", async () => {
            await ApiRequest("/combat/end-turn", {
                id: this.combatId,
            });
        });

        if (Session.gm) {
            const sortButton = buttonContainer.appendChild(Html(`
                <button type="button" class="sort"><i class="fa-solid fa-arrow-up-1-9"></i></button>
            `));
            sortButton.addEventListener("click", async () => {
                await ApiRequest("/combat/sort", {
                    id: this.combatId,
                });
            });

            const shuffleButton = buttonContainer.appendChild(Html(`
                <button type="button" class="shuffle"><i class="fa-solid fa-shuffle"></i></button>
            `));
            shuffleButton.addEventListener("click", async () => {
                await ApiRequest("/combat/shuffle", {
                    id: this.combatId,
                });
            });

            const clearButton = buttonContainer.appendChild(Html(`
                <button type="button" class="clear"><i class="fa-solid fa-trash"></i></button>
            `));
            clearButton.addEventListener("click", async () => {
                if (!await ConfirmDialog("Clear the combat tracker?")) {
                    return;
                }
                await ApiRequest("/combat/clear", {
                    id: this.combatId,
                });
            });

            const addCombatantButton = buttonContainer.appendChild(Html(`
                <button type="button" class="add"><i class="fa-solid fa-user-plus"></i></button>
            `));
            addCombatantButton.addEventListener("click", async () => {
                const selection = await InputDialog("Add Combatant", { "Name": "text" }, "Add");
                if (!selection || !selection.Name) {
                    return;
                }
                await ApiRequest("/combat/add-combatant", {
                    combat_id: this.combatId,
                    name: selection.Name,
                });
            });
        }

        this.register("settings.combat-tracker", () => {
            this.HardRefresh();
        });
    }

    async HardRefresh() {
        this.content.style.display = "none";
        this.combatantContainer.innerHTML = "";
        this.combatantElements = {};
        this.combatantIndexes = {};
        await this.load();
        this.content.style.display = null;
    }

    async AddCombatant(index: number, combatant: Combatant) {
        let character: Character = null;
        if (combatant.character_id) {
            try {
                character = await ResolveCharacter(combatant.character_id, true);
            }
            catch { }
        }

        this.combatantIndexes[combatant.id] = index;

        let initiative: string;
        if (combatant.initiative === null) {
            initiative = "-";
        }
        else {
            initiative = combatant.initiative.toString();
        }
        let combatantElement = this.combatantElements[combatant.id];
        if (combatantElement) {
            this.combatantContainer.appendChild(combatantElement);
            const combatantName = combatantElement.querySelector(".name");
            if (combatantName) {
                combatantName.textContent = combatant.name;
            }
            const combatantInitiative = combatantElement.querySelector(".initiative");
            if (combatantInitiative) {
                combatantInitiative.textContent = initiative;
            }
        }
        else {
            combatantElement = this.combatantContainer.appendChild(Html(`
                <div class="combatant" data-id="${combatant.id}"></div>
            `) as HTMLDivElement);
            if (GetSetting("combat-tracker.columns.image", true)) {
                let image = combatant.image;
                if (!image) {
                    image = "/unknown.png";
                }
                combatantElement.appendChild(Html(`
                    <img class="image" src="${image}">
                `));
            }
            if (GetSetting("combat-tracker.columns.name", true)) {
                combatantElement.appendChild(Html(`
                    <span class="name">${combatant.name}</span>
                `));
            }
            if (character && GetSetting("combat-tracker.columns.shield", false)) {
                const shieldElement = combatantElement.appendChild(Html(`
                    <span class="shield"><i class="fa-solid fa-shield-quartered"></i></span>
                `));
                const shieldNode = shieldElement.appendChild(document.createTextNode(character.temp_hp.toString()));
                this.register(`${character.id}.temp_hp`, (value) => {
                    shieldNode.textContent = value.toString();
                });
            }
            if (character && GetSetting("combat-tracker.columns.hp", false)) {
                const hpElement = combatantElement.appendChild(Html(`
                    <span class="shield"><i class="fa-solid fa-heart"></i></span>
                `));
                const hpNode = hpElement.appendChild(document.createTextNode(character.hp.toString()));
                hpElement.appendChild(document.createTextNode("/"));
                const maxHpNode = hpElement.appendChild(document.createTextNode(character.max_hp.toString()));
                this.register(`${character.id}.hp`, (value) => {
                    hpNode.textContent = value.toString();
                });
                this.register(`${character.id}.max_hp`, (value) => {
                    maxHpNode.textContent = value.toString();
                });
            }
            if (character && GetSetting("combat-tracker.columns.actions", false)) {
                const actionsElement = combatantElement.appendChild(Html(`
                    <span class="actions"><i class="fa-solid fa-circle-a"></i></span>
                `));
                const actionsText = actionsElement.appendChild(document.createTextNode(character.actions.toString()));
                this.register(`${character.id}.actions`, (value) => {
                    actionsText.textContent = value.toString();
                });
            }
            if (character && GetSetting("combat-tracker.columns.reactions", false)) {
                const reactionsElement = combatantElement.appendChild(Html(`
                    <span class="reactions"><i class="fa-duotone fa-exclamation-circle"></i></span>
                `));
                const reactionsText = reactionsElement.appendChild(document.createTextNode(character.reactions.toString()));
                this.register(`${character.id}.reactions`, (value) => {
                    reactionsText.textContent = value.toString();
                });
            }
            if (GetSetting("combat-tracker.columns.initiative", false)) {
                combatantElement.appendChild(Html(`
                    <span class="initiative">${initiative}</span>
                `));
            }
            if (character) {
                combatantElement.dataset.character = character.id;
                combatantElement.addEventListener("click", async () => {
                    const characterSheetWindow = new CharacterSheetWindow({
                        title: "Character Sheet",
                    });
                    await characterSheetWindow.load(character.id);
                });
            }
            if (Session.gm) {
                ContextMenu.set(combatantElement, {
                    "Edit Combatant": {
                        "Rename": async () => {
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
                        "Delete Combatant": async () => {
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
                        "Roll Initiative": async () => {
                            await ApiRequest("/combat/update", {
                                id: this.combatId,
                                changes: {
                                    "$set": {
                                        [`combatants.${this.combatantIndexes[combatant.id]}.initiative`]: Roll("2d6").total
                                    },
                                },
                            });
                        },
                        "Set Initiative": async () => {
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
                        "Clear Initiative": async () => {
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

    async load(id: string = null) {
        await super.load();
        this.setTitle("Combat Tracker");

        let combat: Combat;
        if (id !== null) {
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
            await this.AddCombatant(i, combatant);
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
        await this.subscribe(combat.id, async () => {
            this.refresh();
        });

        this.addDropListener(this.viewPort, async (data) => {
            if (data.type != "characterEntry") {
                return;
            }
            await ApiRequest("/combat/add-combatant", {
                combat_id: combat.id,
                character_id: data.id,
            });
        });
    }

    serialize() {
        return { combatId: this.combatId };
    }

    async deserialize(data) {
        await this.load(data.combatId);
    }
}
registerWindowType(CombatTrackerWindow);
