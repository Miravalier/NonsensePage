import { InputDialog } from "../windows/window.ts";
import * as ContextMenu from "../lib/contextmenu.ts";
import { Character } from "../lib/models.ts";
import { RegisterSheet } from "./sheet.ts";
import { GenericSheet } from "./Generic.ts";
import LightbearerHtml from "./Lightbearer.html?raw";
import LightbearerCss from "./Lightbearer.css?raw";
import { GenerateId } from "../lib/utils.ts";



export class LightbearerSheet extends GenericSheet {
    onRender(data: Character): void {
        super.onRender(data);
        ContextMenu.set(this.container.querySelector(".abilities"), {
            "Create": {
                "New Ability": () => {
                    const abilityId = GenerateId();
                    this.update({
                        "$set": { [`ability_map.${abilityId}`]: { id: abilityId, name: "New Ability" } },
                        "$push": { "ability_order": abilityId },
                    });
                },
            },
        });
        for (const abilityElement of this.container.querySelectorAll<HTMLDivElement>(".ability")) {
            const abilityBar = abilityElement.querySelector(".bar");
            const abilityDetails = abilityElement.querySelector(".details");
            const useButton = abilityBar.querySelector("i.button");
            const abilityId = abilityElement.dataset.id;
            this.addTrigger(`ability_map.${abilityId}.name`, (value) => {
                abilityElement.querySelector(".name").textContent = value;
            });
            ContextMenu.set(abilityElement, {
                "Create": {
                    "New Ability": () => {
                        const abilityId = GenerateId();
                        this.update({
                            "$set": { [`ability_map.${abilityId}`]: { id: abilityId, name: "New Ability" } },
                            "$push": { "ability_order": abilityId },
                        });
                    },
                },
                "Edit": {
                    "Rename": async () => {
                        const selection = await InputDialog("Rename Ability", { "Name": "text" }, "Rename");
                        if (!selection || !selection.Name) {
                            return;
                        }
                        await this.set(`ability_map.${abilityId}.name`, selection.Name);
                    },
                    "Delete": () => {
                        this.update({
                            "$unset": { [`ability_map.${abilityId}`]: 1 },
                            "$pull": { "ability_order": abilityId },
                        });
                    },
                },
            });
            abilityBar.addEventListener("click", () => {
                abilityDetails.classList.toggle("hidden");
            });
            useButton.addEventListener("click", (ev) => {
                ev.stopPropagation();
                console.log("Aaa");
            });
        }
    }
}
RegisterSheet(LightbearerSheet, LightbearerHtml, LightbearerCss);
