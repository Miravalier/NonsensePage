import * as Events from "../../lib/Events.ts";
import * as Hoverable from "../../lib/Hoverable.ts";
import { RegisterDefaultSheet } from "../../lib/Sheet.ts";
import { RegisterIntro } from "../../lib/Intro.ts";
import { RegisterFragment } from "../../lib/Fragments.ts";
import { LoadCss } from "../../lib/Templates.ts";
import { Message } from "../../lib/Models.ts";
import { DieResult } from "../../lib/Dice.ts";
import { NumberWithSign } from "../../lib/Utils.ts";

import { LightbearerSheet } from "./Character.ts";
import { LightbearerCreatorRender } from "./Creator.ts";
import { RollsFragmentRender } from "./Rolls.ts";
import LightbearerCss from "./Lightbearer.css?raw";
import CharacterHtml from "./Character.html?raw";
import CreatorHtml from "./Creator.html?raw";
import AbilityFragment from "./Ability.html?raw";
import RollsFragment from "./Rolls.html?raw";


export async function init() {
    LoadCss("LightbearerCss", LightbearerCss);
    RegisterDefaultSheet(LightbearerSheet, CharacterHtml);
    RegisterIntro(LightbearerCreatorRender, CreatorHtml);
    RegisterFragment("ability", AbilityFragment);
    RegisterFragment("rolls", RollsFragment, RollsFragmentRender);
    Events.register("renderMessage", (_message: Message, element: HTMLDivElement) => {
        element.querySelector(".bar")?.addEventListener("click", () => {
            element.querySelector(".details")?.classList.toggle("hidden");
        });
        for (const resultElement of element.querySelectorAll<HTMLDivElement>(".dice.roll .result")) {
            let captionContent = "";

            const formula = resultElement.dataset.formula;
            if (formula) {
                captionContent += `<div class="formula">${formula}</div>`
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
        }
    });
}
