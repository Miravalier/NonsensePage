import * as ContextMenu from "../../lib/ContextMenu.ts";
import * as Database from "../../lib/Database.ts";
import { ApiRequest } from "../../lib/Requests.ts";
import { AddDragListener } from "../../lib/Drag.ts";
import { InputDialog } from "../../windows/Window.ts";
import { AbilityType, Ability, Character, CharacterAbility } from "../../lib/Models.ts";
import { Sheet } from "../../lib/Sheet.ts";
import { AddDescriptionListeners, GetPermissions, RenderDescription } from "../../lib/Utils.ts";
import { Permissions } from "../../lib/Enums.ts";
import { RenderRolls, GetAbilityIcons } from "./Utils.ts";
import { ErrorToast, WarningToast } from "../../lib/Notifications.ts";
import { Html } from "../../lib/Elements.ts";


async function onAbilityEdit(ability: Ability) {
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

    ability.name = selection.Name;
    ability.description = selection.Description;
    ability.type = selection.Type;
    ability.cooldown = selection.Cooldown;

    await ApiRequest("/ability/update", {
        id: ability.id,
        changes: {
            "$set": {
                name: ability.name,
                description: ability.description,
                type: ability.type,
                cooldown: ability.cooldown,
                rolls: ability.rolls,
            }
        },
    });
}


export async function onAbilityContextMenu(ability: Ability, contextMenuOptions: { [choice: string]: (ev: MouseEvent) => void }) {
    contextMenuOptions["Edit"] = () => onAbilityEdit(ability);
}


export async function onRenderAbilityEntry(element: HTMLDivElement, ability: Ability) {
    element.querySelector("img").remove();
    element.insertBefore(Html(`<div class="icons">${GetAbilityIcons(ability)}</div>`), element.firstChild);
}


export async function UseAbility(character: Character, ability: Ability | CharacterAbility) {
    const characterChanges: Character = {} as Character;

    if (ability.type == AbilityType.Action) {
        characterChanges.actions = character.actions - 1;
    }
    else if (ability.type == AbilityType.Reaction) {
        characterChanges.reactions = character.reactions - 1;
    }

    const rollResults = await RenderRolls(ability.rolls, character.data);
    if (rollResults === null) {
        WarningToast(`Ability '${ability.name}' canceled`);
        return;
    }

    await ApiRequest("/character/update", {
        id: character.id,
        changes: { "$set": characterChanges }
    });
    await ApiRequest("/messages/speak", {
        speaker: character.name,
        character_id: character.id,
        content: `
            <div class="Lightbearer template">
                <div class="ability" data-character-id="${character.id}" data-id="${ability.id}" data-type="${ability.type}">
                    <div class="bar">
                        <div class="row">
                            <div class="icons">${GetAbilityIcons(ability)}</div>
                            <div class="name">${ability.name}</div>
                        </div>
                    </div>
                    <div class="details hidden">${RenderDescription(ability.description)}</div>
                    <div class="chat-rolls">${rollResults}</div>
                </div>
            </div>
        `,
    });
}


export class LightbearerAbilitySheet extends Sheet {
    declare data: Ability;

    onRender(): void {
        super.onRender();
        this.container.classList.add("Lightbearer");
        const permission = GetPermissions(this.data);

        const abilityElement = this.container.querySelector(".ability") as HTMLDivElement;
        const abilityBar = abilityElement.querySelector(".bar");
        const abilityName = abilityBar.querySelector(".name");
        const abilityDetails = abilityElement.querySelector(".details");
        const abilityDescription = abilityDetails.querySelector(".description");
        const abilityIcons = abilityBar.querySelector(".icons");
        const useButton = abilityBar.querySelector("i.button");

        AddDescriptionListeners(abilityDescription);

        AddDragListener(abilityElement, { type: "ability", ability: this.data });

        // Handle changes on this ability
        this.addTrigger("set", `name`, (value) => {
            abilityName.textContent = value;
        });
        this.addTrigger("set", `description`, (value) => {
            abilityDescription.innerHTML = RenderDescription(value);
            AddDescriptionListeners(abilityDescription);
        });
        this.addTrigger("set", `rolls`, (value) => {
            this.data.rolls = value;
        });
        const updateIcons = () => {
            abilityIcons.innerHTML = GetAbilityIcons(this.data);
            if (this.data.type == AbilityType.Passive) {
                abilityName.classList.add("passive");
            }
            else {
                abilityName.classList.remove("passive");
            }
        }
        updateIcons();
        this.addTrigger("set", `type`, () => {
            updateIcons();
        });
        this.addTrigger("set", `cooldown`, () => {
            updateIcons();
        });

        // Add context menu
        if (permission >= Permissions.WRITE) {
            ContextMenu.set(abilityElement, {
                "Ability": {
                    "Edit": () => onAbilityEdit(this.data),
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
            await UseAbility(character, this.data);
        });

        abilityDetails.classList.remove("hidden");
    }
}
