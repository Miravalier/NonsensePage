import { ContentWindow } from "./window.js";
import { ApiRequest, Subscribe } from "./requests.js";
import { AddDropListener } from "./utils.js";
import { ErrorToast } from "./notifications.js";
import { Html } from "./elements.js";


export class CombatTrackerWindow extends ContentWindow {
    constructor(options) {
        options.classList = ["combat-tracker"];
        super(options);
    }

    AddCombatant(combatant) {
        let initiative = combatant.initiative;
        if (initiative === null || initiative === undefined) {
            initiative = "";
        }
        this.combatantContainer.appendChild(Html(`
            <div class="combatant" data-id="${combatant.id}">
                <span class="name">${combatant.name}</span>
                <span class="initiative">${initiative}</span>
            </div>
        `));
    }

    async load(id) {
        await super.load();
        this.content.innerHTML = "";
        this.titleNode.textContent = "Combat Tracker";

        let combat;
        if (id) {
            let response = await ApiRequest("/combat/get", { id });
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
        for (const combatant of combat.combatants) {
            this.AddCombatant(combatant);
        }

        // Set up update watcher
        await this.subscribe(combat.id, async updateData => {
            // Update with changes
        });

        AddDropListener(this.viewPort, async (data) => {
            if (data.type != "character") {
                return false;
            }
            console.log(`Adding character id '${data.id}' to the Combat Tracker`);
            await ApiRequest("/combat/add-combatant", {
                combat_id: combat.id,
                character_id: data.id,
            });
        });
    }
}
