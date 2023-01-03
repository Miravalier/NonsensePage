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

        const response = await ApiRequest("/combat/get", { "create": true });

        if (response.status != "success") {
            ErrorToast(`Combat tracker failed to load.`);
            this.close();
            return;
        }

        // Use response
        for (const combatant of response.combat.combatants) {
            combatant.character_id;
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
