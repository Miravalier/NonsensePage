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

        const response = await ApiRequest("/combat-tracker/list");
        if (response.status != "success") {
            ErrorToast(`Combat tracker failed to load.`);
            this.close();
            return;
        }

        // Use response

        // Set up update watcher
        this.subscription = await Subscribe("combat-tracker", async updateData => {
            // Update with changes
        });

        AddDropListener(this.viewPort, async (data) => {
            if (data.type != "character") {
                return false;
            }
            console.log(`Adding character id '${data.id}' to the Combat Tracker`);
            await ApiRequest("/combat-tracker/add", {id: data.id});
        });
    }
}