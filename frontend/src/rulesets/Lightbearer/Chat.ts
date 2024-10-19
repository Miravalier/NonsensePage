import * as Hoverable from "../../lib/Hoverable.ts";
import * as ContextMenu from "../../lib/ContextMenu.ts";
import { Future } from "../../lib/Async.ts";
import { ApplyDamage, ApplyHealing, ApplyShield } from "../../lib/Database.ts";
import { RollType } from "../../lib/Models.ts";
import { DieResult } from "../../lib/Dice.ts";
import { NumberWithSign } from "../../lib/Utils.ts";
import { ApiRequest, Session } from "../../lib/Requests.ts";
import { Button } from "../../lib/Elements.ts";
import { Dialog, InputDialog } from "../../windows/Window.ts";
import { AbilityType, Character } from "../../lib/Models.ts";


export async function ResultEditDialog(resultElement: HTMLDivElement) {
    const halveButton = Button("chevrons-down");
    halveButton.appendChild(document.createTextNode("Halve"));

    const setButton = Button("equals");
    setButton.appendChild(document.createTextNode("Set"));

    const doubleButton = Button("chevrons-up");
    doubleButton.appendChild(document.createTextNode("Double"));

    const future = new Future<boolean>();
    const dialog = new Dialog({
        title: "Edit Dice Result",
        description: `Total: ${resultElement.textContent}`,
        elements: [
            [halveButton, setButton, doubleButton],
        ],
    });
    dialog.on_close.push(() => {
        future.resolve(false);
    });

    setButton.addEventListener("click", async () => {
        const selection = await InputDialog("Set Result", { "Total": ["number", parseInt(resultElement.textContent)] }, "Set");
        if (!selection) {
            return;
        }
        resultElement.textContent = selection.Total;
        dialog.description.textContent = `Total: ${resultElement.textContent}`;
    });
    halveButton.addEventListener("click", () => {
        resultElement.textContent = Math.round(parseInt(resultElement.textContent) / 2).toString();
        dialog.description.textContent = `Total: ${resultElement.textContent}`;
    });
    doubleButton.addEventListener("click", () => {
        resultElement.textContent = (parseInt(resultElement.textContent) * 2).toString();
        dialog.description.textContent = `Total: ${resultElement.textContent}`;
    });

    return await future
}


export function onRenderMessage(element: HTMLDivElement) {
    const textElement = element.querySelector(".text") as HTMLDivElement;
    const abilityBar = textElement.querySelector(".ability .bar") as HTMLDivElement;
    if (abilityBar) {
        const abilityElement = abilityBar.parentElement as HTMLDivElement;
        const characterId = abilityElement.dataset.characterId;

        abilityBar.addEventListener("click", () => {
            textElement.querySelector(".details")?.classList.toggle("hidden");
        });

        if (Session.gm) {
            ContextMenu.set(abilityBar, {
                "Ability": {
                    "Undo": async () => {
                        await ApiRequest("/messages/delete", { id: element.dataset.id });
                        if (characterId) {
                            const characterChanges: Character = {} as Character;

                            if (parseInt(abilityElement.dataset.type) == AbilityType.Action) {
                                characterChanges.actions = 1;
                            }
                            else if (parseInt(abilityElement.dataset.type) == AbilityType.Reaction) {
                                characterChanges.reactions = 1;
                            }

                            await ApiRequest("/character/update", {
                                id: characterId,
                                changes: { "$inc": characterChanges }
                            });
                        }
                    }
                }
            });
        }
    }
    for (const resultElement of textElement.querySelectorAll<HTMLDivElement>(".roll .result")) {
        const category = resultElement.dataset.category;
        if (category != RollType.Dice && category != RollType.Damage && category != RollType.Healing && category != RollType.Shield) {
            continue;
        }

        let captionContent = "";

        const formula = resultElement.dataset.formula;
        if (formula) {
            captionContent += `<div class="formula">${formula}</div>`;
        }

        try {
            const rolls: DieResult[] = JSON.parse(atob(resultElement.dataset.dice));
            for (const roll of rolls) {
                if (!roll.sides) {
                    captionContent += `<div class="value">${NumberWithSign(roll.result)}</div>`;
                }
                else {
                    let dieIcon = "d20";
                    if ([4, 6, 8, 10, 12, 20].indexOf(roll.sides) !== -1) {
                        dieIcon = `d${roll.sides}`;
                    }
                    captionContent += `<div class="die"><i class="fa-solid fa-dice-${dieIcon}"></i>${roll.result}</div>`;
                }
            }
        } catch (error) { }

        if (captionContent) {
            const caption = document.createElement("div");
            caption.className = "Lightbearer caption";
            caption.innerHTML = captionContent;
            Hoverable.set(resultElement.parentElement, caption);
        }

        resultElement.parentElement.addEventListener("dblclick", () => {
            const category = resultElement.dataset.category;
            if (category == "healing") {
                ApplyHealing(parseInt(resultElement.textContent));
            }
            else if (category == "shield") {
                ApplyShield(parseInt(resultElement.textContent));
            }
            else {
                ApplyDamage(parseInt(resultElement.textContent));
            }
        });

        const diceResultOptions = {
            "Apply Damage": () => {
                ApplyDamage(parseInt(resultElement.textContent));
            },
            "Apply Healing": () => {
                ApplyHealing(parseInt(resultElement.textContent));
            },
            "Apply Shield": () => {
                ApplyShield(parseInt(resultElement.textContent));
            }
        };
        if (Session.gm) {
            diceResultOptions["Edit"] = async () => {
                // Modify the resultElement in-place
                await ResultEditDialog(resultElement);

                // Apply changes back to the DB
                await ApiRequest("/messages/edit", { id: element.dataset.id, content: textElement.innerHTML });
            };
        }
        ContextMenu.set(resultElement.parentElement, {
            "Dice Result": diceResultOptions,
        });
    }
}
