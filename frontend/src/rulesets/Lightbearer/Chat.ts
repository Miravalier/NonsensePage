import { ResolveCharacter, TakeDamage } from "../../lib/Database.ts";
import { ApiRequest, Session } from "../../lib/Requests.ts";
import { ErrorToast } from "../../lib/Notifications.ts";
import { Character, Message } from "../../lib/Models.ts";
import { DieResult } from "../../lib/Dice.ts";
import { Bound, NumberWithSign } from "../../lib/Utils.ts";
import * as Hoverable from "../../lib/Hoverable.ts";
import * as ContextMenu from "../../lib/ContextMenu.ts";


export function onRenderMessage(_message: Message, element: HTMLDivElement) {
    element.querySelector(".bar")?.addEventListener("click", () => {
        element.querySelector(".details")?.classList.toggle("hidden");
    });
    for (const resultElement of element.querySelectorAll<HTMLDivElement>(".dice.roll .result")) {
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
            TakeDamage(parseInt(resultElement.textContent));
        })

        ContextMenu.set(resultElement.parentElement, {
            "Dice Result": {
                "Take as Damage": async () => {
                    TakeDamage(parseInt(resultElement.textContent));
                },
            },
        });
    }
}
