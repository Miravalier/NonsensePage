import * as Events from "../../lib/events.ts";
import { RegisterDefaultSheet } from "../../lib/sheet.ts";
import { RegisterIntro } from "../../lib/intro.ts";
import { RegisterFragment } from "../../lib/fragments.ts";
import { LoadCss } from "../../lib/templates.ts";
import { Message } from "../../lib/models.ts";

import { LightbearerSheet } from "./character.ts";
import { LightbearerCreatorRender } from "./creator.ts";
import { RollsFragmentRender } from "./rolls.ts";
import LightbearerCss from "./lightbearer.css?raw";
import CharacterHtml from "./character.html?raw";
import CreatorHtml from "./creator.html?raw";
import AbilityFragment from "./ability.html?raw";
import RollsFragment from "./rolls.html?raw";


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
