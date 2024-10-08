import * as ContextMenu from "../../lib/ContextMenu.ts";
import * as Dice from "../../lib/Dice.ts";
import { AddDragListener } from "../../lib/Drag.ts";
import { InputDialog } from "../../windows/Window.ts";
import { CharacterAbility, AbilityType, Character } from "../../lib/Models.ts";
import { Sheet } from "../../lib/Sheet.ts";
import { GenerateId, GetPermissions, ResolvePath, SetPath } from "../../lib/Utils.ts";
import { ApiRequest } from "../../lib/Requests.ts";
import { Permissions } from "../../lib/Enums.ts";
import { RenderRolls, GetAbilityIcons } from "./Utils.ts";


export class LightbearerCharacterSheet extends Sheet {
    onRender(data: Character): void {
        super.onRender(data);
        this.container.classList.add("Lightbearer");
        const permission = GetPermissions(data);

        if (permission >= Permissions.WRITE) {
            const abilityContainer = this.container.querySelector<HTMLDivElement>(".abilities");
            ContextMenu.set(abilityContainer, {
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
            this.parent.addDropListener(this.container, (data) => {
                if (data.type != "ability") {
                    return;
                }
                const droppedAbility: CharacterAbility = data.ability;
                droppedAbility.id = GenerateId();
                this.update({
                    "$set": { [`ability_map.${droppedAbility.id}`]: droppedAbility },
                    "$push": { "ability_order": droppedAbility.id },
                });
            });
        }
        for (const abilityElement of this.container.querySelectorAll<HTMLDivElement>(".ability")) {
            const abilityBar = abilityElement.querySelector(".bar");
            const abilityName = abilityBar.querySelector(".name");
            const abilityDetails = abilityElement.querySelector(".details");
            const abilityDescription = abilityDetails.querySelector(".description");
            const abilityIcons = abilityBar.querySelector(".icons");
            const useButton = abilityBar.querySelector("i.button");
            const abilityId = abilityElement.dataset.id;
            const ability = data.ability_map[abilityId];

            AddDragListener(abilityElement, { type: "ability", characterId: data.id, ability });

            // If the entire ability changes, propagate to each subfield
            this.addTrigger(`ability_map.${abilityId}`, (value) => {
                for (const [key, subvalue] of Object.entries(value)) {
                    this.onSet(`ability_map.${abilityId}.${key}`, subvalue);
                }
            });

            // Handle changes on this ability
            this.addTrigger(`ability_map.${abilityId}.name`, (value) => {
                ability.name = value;
                abilityName.textContent = value;
            });
            this.addTrigger(`ability_map.${abilityId}.description`, (value) => {
                ability.description = value;
                abilityDescription.innerHTML = value.replace("\n", "<br>");
            });
            this.addTrigger(`ability_map.${abilityId}.rolls`, (value) => {
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
            this.addTrigger(`ability_map.${abilityId}.type`, (value) => {
                ability.type = value;
                updateIcons();
            });
            this.addTrigger(`ability_map.${abilityId}.cooldown`, (value) => {
                ability.cooldown = value;
                updateIcons();
            });

            // Add context menu
            if (permission >= Permissions.WRITE) {
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
                            await this.set(
                                `ability_map.${abilityId}`,
                                {
                                    id: abilityId,
                                    name: selection.Name,
                                    description: selection.Description,
                                    type: selection.Type,
                                    cooldown: selection.Cooldown,
                                    rolls: ability.rolls,
                                }
                            );
                        },
                        "Delete": () => {
                            this.update({
                                "$unset": { [`ability_map.${abilityId}`]: 1 },
                                "$pull": { "ability_order": abilityId },
                            });
                        },
                    },
                });
            }

            // Expand details when the ability is clicked
            abilityBar.addEventListener("click", () => {
                abilityDetails.classList.toggle("hidden");
            });

            // Use the ability when the die is clicked
            if (permission >= Permissions.WRITE) {
                useButton.addEventListener("click", async (ev) => {
                    ev.stopPropagation();
                    await ApiRequest("/messages/speak", {
                        speaker: data.name,
                        character_id: data.id,
                        content: `
                            <div class="Lightbearer template">
                                <div class="ability" data-character-id="${data.id}" data-id="${ability.id}">
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
            }
        }

        for (const statsContainer of this.container.querySelectorAll<HTMLDivElement>(".stats")) {
            for (const field of statsContainer.querySelectorAll<HTMLDivElement>(".field")) {
                const label = field.querySelector<HTMLDivElement>(".label");
                const statInput = field.querySelector("input");
                this.addTrigger(statInput.dataset.attr, (value) => {
                    SetPath(data, statInput.dataset.attr, value);
                });
                label.addEventListener("click", async () => {
                    const stat = ResolvePath(data, statInput.dataset.attr);
                    const formula = `2d6+${Math.floor(stat / 2)}`;
                    const rollResults = Dice.Roll(formula);
                    await ApiRequest("/messages/speak", {
                        speaker: data.name,
                        character_id: data.id,
                        content: `
                            <div class="template">
                                <div class="stat" data-character-id="${data.id}" data-attr="${statInput.dataset.attr}">
                                    <div class="chat-rolls">
                                        <div class="dice roll">
                                            <div class="label">${label.innerText}</div>
                                            <div class="result" data-category="dice" data-formula="${formula}" data-dice="${btoa(JSON.stringify(rollResults.rolls))}">${rollResults.total}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `,
                    });
                });
            }
        }
    }
}
