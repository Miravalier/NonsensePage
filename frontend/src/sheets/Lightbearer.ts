import * as ContextMenu from "../lib/contextmenu.ts";
import * as Events from "../lib/events.ts";
import { PCG } from "../lib/pcg-random.ts";
import { InputDialog } from "../windows/window.ts";
import { Ability, AbilityType, Character, Message, RollType } from "../lib/models.ts";
import { RegisterSheet } from "./sheet.ts";
import { GenericSheet } from "./Generic.ts";
import { GenerateId, GetPermissions } from "../lib/utils.ts";
import { ApiRequest } from "../lib/requests.ts";
import { Roll } from "../lib/dice.ts";
import LightbearerHtml from "./Lightbearer.html?raw";
import LightbearerCss from "./Lightbearer.css?raw";
import { Permissions } from "../lib/enums.ts";


const attribute_modifiers = {
    // Classes
    "Assassin": { "agility": 5, "perception": 2, "charisma": -2, "endurance": -2, "power": -2 },
    "Bard": { "charisma": 5, "memory": 5, "perception": -2, "agility": -1, "endurance": -3, "power": -3 },
    "Berserker": { "power": 5, "endurance": 4, "agility": 3, "charisma": -5, "memory": -3, "perception": -3 },
    "Cleric": { "charisma": 4, "endurance": 3, "agility": -2, "perception": -2, "power": -2 },
    "Druid": { "memory": 4, "perception": 2, "charisma": -2, "agility": -1, "power": -1, "endurance": -1 },
    "Elementalist": { "memory": 5, "charisma": -1, "power": -1, "endurance": -1, "agility": -1 },
    "Guardian": { "endurance": 6, "charisma": 1, "agility": -1, "memory": -1, "perception": -2, "power": -2 },
    "Necromancer": { "memory": 6, "charisma": -5 },
    // Races
    "Aarakocra": { "agility": 3, "perception": 3, "endurance": -2, "memory": -2, "charisma": -1 },
    "Centaur": { "power": 2, "endurance": 4, "agility": -3, "perception": -2 },
    "Dragonborn": { "power": 4, "endurance": 2, "agility": -3, "memory": -1, "charisma": -1 },
    "Dwarf": { "endurance": 4, "agility": -2, "perception": -1 },
    "Elf": { "agility": 3, "perception": 2, "memory": 2, "power": -3, "endurance": -3 },
    "Gnome": { "memory": 6, "charisma": 4, "agility": 1, "power": -5, "endurance": -5 },
    "Goliath": { "endurance": 6, "power": 6, "memory": -4, "charisma": -4, "agility": -3 },
    "Halfling": { "agility": 2, "charisma": 2, "power": -2, "endurance": -1 },
    "Human": {},
    "Orc": { "power": 2, "agility": 2, "endurance": 2, "memory": -2, "perception": -2, "charisma": -1 },
    "Satyr": { "memory": 4, "agility": 2, "power": -2, "endurance": -2, "perception": -1 },
    "Tabaxi": { "agility": 6, "perception": 3, "power": -2, "endurance": -4, "memory": -2 },
    "Tiefling": { "power": 3, "memory": 3, "charisma": -4, "agility": -1 },
    "Triton": { "perception": 2, "agility": 2, "memory": 2, "power": -3, "endurance": -2 },
    "Warforged": { "power": 3, "endurance": 3, "memory": 3, "perception": -4, "charisma": -4 },
};

const skill_modifiers = {
    // Classes
    "Assassin": ["stealth", "melee"],
    "Bard": ["spellwork"],
    "Berserker": ["melee"],
    "Cleric": ["spellwork"],
    "Druid": ["spellwork", "tracking"],
    "Elementalist": ["spellwork"],
    "Guardian": ["melee"],
    "Necromancer": ["spellwork"],
    // Races
    "Aarakocra": ["tracking"],
    "Centaur": ["ranged"],
    "Dragonborn": ["melee"],
    "Dwarf": ["artifice"],
    "Elf": ["ranged"],
    "Gnome": ["spellwork"],
    "Goliath": ["melee"],
    "Halfling": ["stealth"],
    "Human": ["artifice"],
    "Orc": ["melee", "melee"],
    "Satyr": ["spellwork"],
    "Tabaxi": ["stealth"],
    "Tiefling": ["spellwork"],
    "Triton": ["tracking"],
    "Warforged": ["melee"],
};

const skill_levels = [
    "Untrained", "Novice", "Skilled",
    "Expert", "Master", "Legend"
]

const descriptions = {
    // Classes
    "Assassin": "Stealthy, melee, single-target damage dealer",
    "Bard": "Team-oriented with large AoE buffs and debuffs",
    "Berserker": "Frontline brute with risky abilities",
    "Cleric": "Healer and ranged support",
    "Druid": "Shapeshifting jack of all trades",
    "Elementalist": "High-damage ranged powerhouse",
    "Guardian": "Melee tank that keeps allies out of danger",
    "Necromancer": "Undead-summoning ranged support",
    // Races
    "Aarakocra": "Agile and capable of flight",
    "Centaur": "Fast and tough",
    "Dragonborn": "Scaled and breathes fire",
    "Dwarf": "Short and sturdy",
    "Elf": "Agile and perceptive",
    "Gnome": "Small and weak, but intelligent",
    "Goliath": "Massive and strong",
    "Halfling": "Small and unassuming",
    "Human": "Adaptable",
    "Orc": "Athletic and resilient",
    "Satyr": "Intelligent and energetic",
    "Tabaxi": "Nimble feline humanoid",
    "Tiefling": "Cunning half-demon",
    "Triton": "Amphibious with natural electricity",
    "Warforged": "Automaton created by war mages",
};


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
        const permission = GetPermissions(data);

        if (permission >= Permissions.WRITE) {
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
            }
        }
    }
}
RegisterSheet(LightbearerSheet, LightbearerHtml, LightbearerCss);


Events.register("renderMessage", (_message: Message, element: HTMLDivElement) => {
    element.querySelector(".bar")?.addEventListener("click", () => {
        element.querySelector(".details")?.classList.toggle("hidden");
    });
});
