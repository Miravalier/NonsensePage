import { ContentWindow } from "./window.js";
import { ApiRequest, Subscribe } from "./requests.js";
import { AddDropListener } from "./utils.js";
import { ErrorToast } from "./notifications.js";


export class CombatTrackerWindow extends ContentWindow {
    constructor(options) {
        options.classList = ["combat-tracker"];
        super(options);
        this.subscription = null;
    }

    close() {
        if (this.subscription) {
            this.subscription.cancel();
        }
        super.close();
    }

    async load() {
        this.titleNode.textContent = "Combat Tracker";

        let response = await ApiRequest("/combat/list");
        if (response.status != "success") {
            ErrorToast(`Combat tracker failed to load.`);
            this.close();
            return;
        }

        let combats;
        if (response.combats.length > 0) {
            combats = response.combats;
        }
        else {
            response = await ApiRequest("/combat/create", { name: "New Combat" });
            if (response.status != "success") {
                ErrorToast(`Combat tracker failed to create.`);
                this.close();
                return;
            }
            combats = [response.combat];
        }

        // Use response
        const combat = combats[0];
        for (const combatant of combat.combatants) {
            console.log("Combatant", combatant);
        }

        // Set up update watcher
        this.subscription = await Subscribe("combat", async updateData => {
            // Update with changes
        });

        AddDropListener(this.viewPort, async (data) => {
            if (data.type != "character") {
                return false;
            }
            console.log(`Adding character id '${data.id}' to the Combat Tracker`);
            await ApiRequest("/combat/add-combatant", {
                character_id: data.id,
                name: data.name,
            });
        });
    }
}
