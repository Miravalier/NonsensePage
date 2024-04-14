import * as Events from "../../lib/Events.ts";
import { RegisterDefaultSheet } from "../../lib/Sheet.ts";
import { RegisterIntro } from "../../lib/Intro.ts";
import { RegisterFragment } from "../../lib/Fragments.ts";
import { LoadCss } from "../../lib/Templates.ts";
import { Message } from "../../lib/Models.ts";

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
    });
}