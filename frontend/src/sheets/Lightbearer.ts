import * as ContextMenu from "../lib/contextmenu.ts";
import * as Events from "../lib/events.ts";
import { PCG } from "../lib/pcg-random.ts";
import { InputDialog } from "../windows/window.ts";
import { Ability, AbilityType, Character, Message, RollType } from "../lib/models.ts";
import { RegisterSheet } from "./sheet.ts";
import { GenericSheet } from "./Generic.ts";
import { GenerateId } from "../lib/utils.ts";
import { ApiRequest } from "../lib/requests.ts";
import { Roll } from "../lib/dice.ts";
import LightbearerHtml from "./Lightbearer.html?raw";
import LightbearerCss from "./Lightbearer.css?raw";


function getIcons(ability: Ability) {
    let icons = "";
    const typeIcon = {
        [AbilityType.Free]: "fa-regular fa-circle",
        [AbilityType.Action]: "fa-solid fa-circle-a",
        [AbilityType.Reaction]: "fa-duotone fa-exclamation-circle",
    }[ability.type];
    if (typeIcon) {
        icons += '<div class="icon">';
        icons += `<i class="${typeIcon}"></i>`;
        icons += '</div>';
    }
    if (ability.cooldown > 0) {
        icons += '<div class="icon">';
        icons += `<span class="cooldown">${ability.cooldown}</span>`;
        icons += `<i class="fa-solid fa-hourglass"></i>`;
        icons += '</div>';
    }
    return icons;
}


function rollAbility(ability: Ability): string {
    let result = "";
    for (const roll of ability.rolls) {
        let subresult = `<div class="${roll.type} roll">`;
        subresult += `<div class="label">${roll.label}</div>`;
        if (roll.type == RollType.Text) {
            subresult += `<div class="result">${roll.formula}</div>`;
        }
        else if (roll.type == RollType.Dice) {
            const rollResults = Roll(roll.formula);
            subresult += `<div class="result">${rollResults.total}</div>`;
        }
        else if (roll.type == RollType.Table) {
            const choiceResult = PCG.choice(roll.formula.split(/ *, */));
            subresult += `<div class="result">${choiceResult}</div>`;
        }
        subresult += '</div>';
        result += subresult;
    }
    return result;
}


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
            const abilityName = abilityBar.querySelector(".name");
            const abilityDetails = abilityElement.querySelector(".details");
            const abilityDescription = abilityDetails.querySelector(".description");
            const abilityIcons = abilityBar.querySelector(".icons");
            const useButton = abilityBar.querySelector("i.button");
            const abilityId = abilityElement.dataset.id;
            const ability = data.ability_map[abilityId];

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
                abilityDescription.innerHTML = value;
            });
            this.addTrigger(`ability_map.${abilityId}.rolls`, (value) => {
                ability.rolls = value;
            });
            const updateIcons = () => {
                abilityIcons.innerHTML = getIcons(ability);
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

            // Expand details when the ability is clicked
            abilityBar.addEventListener("click", () => {
                abilityDetails.classList.toggle("hidden");
            });

            // Use the ability when the die is clicked
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
                                        <div class="icons">${getIcons(ability)}</div>
                                        <div class="name">${ability.name}</div>
                                    </div>
                                </div>
                                <div class="details hidden">${ability.description}</div>
                                <div class="rolls">${rollAbility(ability)}</div>
                            </div>
                        </div>
                    `,
                });
            });

            //
        }
    }
}
RegisterSheet(LightbearerSheet, LightbearerHtml, LightbearerCss);


Events.register("renderMessage", (_message: Message, element: HTMLDivElement) => {
    element.querySelector(".bar")?.addEventListener("click", () => {
        element.querySelector(".details")?.classList.toggle("hidden");
    });
});
