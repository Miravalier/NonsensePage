import * as ContextMenu from "../../lib/ContextMenu.ts";
import * as Dice from "../../lib/Dice.ts";
import { AddDragListener } from "../../lib/Drag.ts";
import { InputDialog } from "../../windows/Window.ts";
import { CharacterAbility, AbilityType, Character, Ability, Permission } from "../../lib/Models.ts";
import { TabbedSheet } from "../../lib/Sheet.ts";
import { GenerateId, GetPermissions, ResolvePath } from "../../lib/Utils.ts";
import { ApiRequest } from "../../lib/Requests.ts";
import { Permissions } from "../../lib/Enums.ts";
import { GetAbilityIcons } from "./Utils.ts";
import { AppendFragment } from "../../lib/Templates.ts";
import { UseAbility } from "./Ability.ts";


export class LightbearerCharacterSheet extends TabbedSheet {
    declare data: Character;

    addItemTriggers(itemElement: HTMLDivElement, permission: Permission) {
        const itemId = itemElement.dataset.id;
        const itemName = itemElement.querySelector<HTMLDivElement>(".name");
        const item = this.data.item_map[itemId];

        this.addTrigger("unset", `item_map.${itemId}`, () => {
            itemElement.remove();
        });

        itemElement.querySelector(".delete.button").addEventListener("click", () => {
            this.update({
                "$unset": { [`item_map.${itemId}`]: 1 },
                "$pull": { "item_order": itemId },
            });
        });

        this.addTrigger("set", `item_map.${itemId}`, (value) => {
            for (const [key, subvalue] of Object.entries(value)) {
                this.onTrigger("set", `item_map.${itemId}.${key}`, subvalue);
            }
        });

        this.addTrigger("set", `item_map.${itemId}.name`, (value) => {
            item.name = value;
            itemName.textContent = value;
        });

        if (permission >= Permission.Write) {
            itemName.contentEditable = "true";
        }
        else {
            itemName.contentEditable = "false";
        }

        itemName.addEventListener("blur", async () => {
            await this.set(`item_map.${itemId}.name`, itemName.textContent);
        });
    }

    addAbilityTriggers(abilityElement: HTMLDivElement, permission: Permission) {
        const abilityBar = abilityElement.querySelector(".bar");
        const abilityName = abilityBar.querySelector(".name");
        const abilityDetails = abilityElement.querySelector(".details");
        const abilityDescription = abilityDetails.querySelector(".description");
        const abilityIcons = abilityBar.querySelector(".icons");
        const useButton = abilityBar.querySelector("i.button");
        const abilityId = abilityElement.dataset.id;
        const ability = this.data.ability_map[abilityId];

        AddDragListener(abilityElement, { type: "ability", characterId: this.data.id, ability });

        // If the ability is unset, remove it
        this.addTrigger("unset", `ability_map.${abilityId}`, () => {
            abilityElement.remove();
        });

        // If the entire ability changes, propagate to each subfield
        this.addTrigger("set", `ability_map.${abilityId}`, (value) => {
            for (const [key, subvalue] of Object.entries(value)) {
                this.onTrigger("set", `ability_map.${abilityId}.${key}`, subvalue);
            }
        });

        // Handle changes on this ability
        this.addTrigger("set", `ability_map.${abilityId}.name`, (value) => {
            ability.name = value;
            abilityName.textContent = value;
        });
        this.addTrigger("set", `ability_map.${abilityId}.description`, (value) => {
            ability.description = value;
            abilityDescription.innerHTML = value.replace("\n", "<br>");
        });
        this.addTrigger("set", `ability_map.${abilityId}.rolls`, (value) => {
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
        this.addTrigger("set", `ability_map.${abilityId}.type`, (value) => {
            ability.type = value;
            updateIcons();
        });
        this.addTrigger("set", `ability_map.${abilityId}.cooldown`, (value) => {
            ability.cooldown = value;
            updateIcons();
        });

        // Add context menu
        if (permission >= Permissions.WRITE) {
            ContextMenu.set(abilityElement, {
                "Create": {
                    "New Ability": async () => {
                        const abilityId = GenerateId();
                        await this.update({
                            "$set": {
                                [`ability_map.${abilityId}`]: {
                                    id: abilityId,
                                    name: "New Ability",
                                    image: "",
                                    description: "",
                                    type: AbilityType.Passive,
                                    cooldown: 0,
                                    rolls: [],
                                }
                            },
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
                    "Duplicate": () => {
                        const copiedAbility = structuredClone(ability);
                        copiedAbility.id = GenerateId();
                        this.update({
                            "$set": { [`ability_map.${copiedAbility.id}`]: copiedAbility },
                            "$push": { "ability_order": copiedAbility.id },
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
                await UseAbility(this.data, ability);
            });
        }
    }

    onRender(): void {
        super.onRender();
        this.container.classList.add("Lightbearer");
        const permission = GetPermissions(this.data);
        const abilityContainer = this.container.querySelector<HTMLDivElement>(".abilities");
        const itemContainer = this.container.querySelector<HTMLDivElement>(".inventory");
        const addItemButton = itemContainer.querySelector<HTMLButtonElement>("button.add-item");

        if (permission >= Permissions.WRITE) {
            addItemButton.addEventListener("click", () => {
                const itemId = GenerateId();
                this.update({
                    "$set": { [`item_map.${itemId}`]: { id: itemId, name: "" } },
                    "$push": { "item_order": itemId },
                });
            });
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
            ContextMenu.set(itemContainer, {
                "Create": {
                    "New Item": () => {
                        const itemId = GenerateId();
                        this.update({
                            "$set": { [`item_map.${itemId}`]: { id: itemId, name: "" } },
                            "$push": { "item_order": itemId },
                        });
                    },
                },
            });
            this.parent.addDropListener(this.container, async (data) => {
                let droppedAbility: CharacterAbility | Ability;
                if (data.type == "ability") {
                    droppedAbility = data.ability;
                }
                else if (data.type == "abilityEntry") {
                    const response = await ApiRequest("/ability/get", { id: data.id });
                    droppedAbility = response.ability;
                }
                else {
                    return;
                }

                droppedAbility.id = GenerateId();
                this.update({
                    "$set": { [`ability_map.${droppedAbility.id}`]: droppedAbility },
                    "$push": { "ability_order": droppedAbility.id },
                });
            });
        }
        else {
            addItemButton.style.display = "none";
        }

        this.addTrigger("push", "item_order", (itemId) => {
            const itemElement = AppendFragment(itemContainer, "item", this.data.item_map[itemId]) as HTMLDivElement;
            this.addItemTriggers(itemElement, permission);
        });

        for (const itemElement of this.container.querySelectorAll<HTMLDivElement>(".inventory .item")) {
            this.addItemTriggers(itemElement, permission);
        }

        this.addTrigger("push", "ability_order", (abilityId) => {
            const abilityElement = AppendFragment(abilityContainer, "ability", this.data.ability_map[abilityId]) as HTMLDivElement;
            this.addAbilityTriggers(abilityElement, permission);
        });

        for (const abilityElement of this.container.querySelectorAll<HTMLDivElement>(".ability")) {
            this.addAbilityTriggers(abilityElement, permission);
        }

        for (const statsContainer of this.container.querySelectorAll<HTMLDivElement>(".stats")) {
            for (const field of statsContainer.querySelectorAll<HTMLDivElement>(".field")) {
                const label = field.querySelector<HTMLDivElement>(".label");
                const statInput = field.querySelector("input");
                label.addEventListener("click", async () => {
                    const stat = ResolvePath(this.data, statInput.dataset.attr);
                    const formula = `2d6+${Math.floor(stat / 2)}`;
                    const rollResults = Dice.Roll(formula);
                    await ApiRequest("/messages/speak", {
                        speaker: this.data.name,
                        character_id: this.data.id,
                        content: `
                            <div class="template">
                                <div class="stat" data-character-id="${this.data.id}" data-attr="${statInput.dataset.attr}">
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
