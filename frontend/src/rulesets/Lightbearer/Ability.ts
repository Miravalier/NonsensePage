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
import { Html } from "../../lib/Elements.ts";


export async function onRenderAbilityEntry(element: HTMLDivElement, ability: Ability) {
    element.querySelector("img").remove();
    element.insertBefore(Html(`<div class="icons">${GetAbilityIcons(ability)}</div>`), element.firstChild);
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

        AddDragListener(abilityElement, { type: "ability", ability: this.data });

        // Handle changes on this ability
        this.addTrigger(`name`, (value) => {
            abilityName.textContent = value;
        });
        this.addTrigger(`description`, (value) => {
            abilityDescription.innerHTML = value.replace("\n", "<br>");
        });
        this.addTrigger(`rolls`, (value) => {
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
        this.addTrigger(`type`, () => {
            updateIcons();
        });
        this.addTrigger(`cooldown`, () => {
            updateIcons();
        });

        // Add context menu
        if (permission >= Permissions.WRITE) {
            ContextMenu.set(abilityElement, {
                "Ability": {
                    "Edit": async () => {
                        const savedRolls = structuredClone(this.data.rolls);
                        const selection = await InputDialog(
                            "Edit Ability",
                            {
                                "Name": ["text", this.data.name],
                                "Type": [
                                    "select",
                                    {
                                        "0": "Passive",
                                        "1": "Free",
                                        "2": "Action",
                                        "3": "Reaction",
                                    },
                                    this.data.type,
                                ],
                                "Cooldown": [
                                    "select",
                                    {
                                        "0": "None",
                                        "1": "1 Round",
                                        "2": "2 Rounds",
                                        "3": "3 Rounds",
                                    },
                                    this.data.cooldown,
                                ],
                                "Description": ["paragraph", this.data.description],
                                "Rolls": ["fragment", "rolls", this.data],
                            },
                            "Save"
                        );
                        if (!selection) {
                            this.data.rolls = savedRolls;
                            return;
                        }
                        await this.update({
                            "$set": {
                                name: selection.Name,
                                description: selection.Description,
                                type: selection.Type,
                                cooldown: selection.Cooldown,
                                rolls: this.data.rolls,
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
                        <div class="ability" data-character-id="${character.id}" data-id="${this.data.id}">
                            <div class="bar">
                                <div class="row">
                                    <div class="icons">${GetAbilityIcons(this.data)}</div>
                                    <div class="name">${this.data.name}</div>
                                </div>
                            </div>
                            <div class="details hidden">${this.data.description.replace("\n", "<br>")}</div>
                            <div class="chat-rolls">${RenderRolls(this.data.rolls)}</div>
                        </div>
                    </div>
                `,
            });
        });

        abilityDetails.classList.remove("hidden");
    }
}