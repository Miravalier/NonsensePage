import * as ContextMenu from "../../lib/ContextMenu.ts";
import * as Database from "../../lib/Database.ts";
import { ApiRequest } from "../../lib/Requests.ts";
import { AddDragListener } from "../../lib/Drag.ts";
import { InputDialog } from "../../windows/Window.ts";
import { AbilityType, Ability } from "../../lib/Models.ts";
import { Sheet } from "../../lib/Sheet.ts";
import { GetPermissions } from "../../lib/Utils.ts";
import { Permissions } from "../../lib/Enums.ts";
import { RenderRolls, GetAbilityIcons } from "./Utils.ts";
import { ErrorToast } from "../../lib/Notifications.ts";


export class LightbearerAbilitySheet extends Sheet {
    onRender(data: Ability): void {
        super.onRender(data);
        this.container.classList.add("Lightbearer");
        const permission = GetPermissions(data);

        const abilityElement = this.container.querySelector(".ability") as HTMLDivElement;
        const abilityBar = abilityElement.querySelector(".bar");
        const abilityName = abilityBar.querySelector(".name");
        const abilityDetails = abilityElement.querySelector(".details");
        const abilityDescription = abilityDetails.querySelector(".description");
        const abilityIcons = abilityBar.querySelector(".icons");
        const useButton = abilityBar.querySelector("i.button");
        const ability = data;

        AddDragListener(abilityElement, { type: "ability", ability });

        // Handle changes on this ability
        this.addTrigger(`name`, (value) => {
            ability.name = value;
            abilityName.textContent = value;
        });
        this.addTrigger(`description`, (value) => {
            ability.description = value;
            abilityDescription.innerHTML = value.replace("\n", "<br>");
        });
        this.addTrigger(`rolls`, (value) => {
            ability.rolls = value;
        });
        const updateIcons = () => {
            abilityIcons.innerHTML = GetAbilityIcons(ability);
            if (ability.type == AbilityType.Passive) {
                abilityName.classList.add("passive");
            }
            else {
                abilityName.classList.remove("passive");
            }
        }
        updateIcons();
        this.addTrigger(`type`, (value) => {
            ability.type = value;
            updateIcons();
        });
        this.addTrigger(`cooldown`, (value) => {
            ability.cooldown = value;
            updateIcons();
        });

        // Add context menu
        if (permission >= Permissions.WRITE) {
            ContextMenu.set(abilityElement, {
                "Ability": {
                    "Edit": async () => {
                        const savedRolls = structuredClone(ability.rolls);
                        const selection = await InputDialog(
                            "Edit Ability",
                            {
                                "Name": ["text", ability.name],
                                "Type": [
                                    "select",
                                    {
                                        "0": "Passive",
                                        "1": "Free",
                                        "2": "Action",
                                        "3": "Reaction",
                                    },
                                    ability.type,
                                ],
                                "Cooldown": [
                                    "select",
                                    {
                                        "0": "None",
                                        "1": "1 Round",
                                        "2": "2 Rounds",
                                        "3": "3 Rounds",
                                    },
                                    ability.cooldown,
                                ],
                                "Description": ["paragraph", ability.description],
                                "Rolls": ["fragment", "rolls", ability],
                            },
                            "Save"
                        );
                        if (!selection) {
                            ability.rolls = savedRolls;
                            return;
                        }
                        await this.update({
                            "$set": {
                                name: selection.Name,
                                description: selection.Description,
                                type: selection.Type,
                                cooldown: selection.Cooldown,
                                rolls: ability.rolls,
                            }
                        });
                    },
                },
            });
        }

        useButton.addEventListener("click", async (ev) => {
            ev.stopPropagation();
            const character = await Database.GetCharacter();
            if (!character) {
                ErrorToast("No controlled character.");
                return;
            }
            await ApiRequest("/messages/speak", {
                speaker: character.name,
                character_id: character.id,
                content: `
                    <div class="Lightbearer template">
                        <div class="ability" data-character-id="${character.id}" data-id="${ability.id}">
                            <div class="bar">
                                <div class="row">
                                    <div class="icons">${GetAbilityIcons(ability)}</div>
                                    <div class="name">${ability.name}</div>
                                </div>
                            </div>
                            <div class="details hidden">${ability.description.replace("\n", "<br>")}</div>
                            <div class="chat-rolls">${RenderRolls(ability.rolls)}</div>
                        </div>
                    </div>
                `,
            });
        });

        abilityDetails.classList.remove("hidden");
    }
}
