import { ContentWindow } from "./window.js";
import { Subscribe } from "./requests.js";


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

        // Set up update watcher
        this.subscription = await Subscribe("combat-tracker", async updateData => {
            this.update(updateData);
        });
    }
}