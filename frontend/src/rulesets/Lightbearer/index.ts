import * as Events from "../../lib/Events.ts";
import { RegisterSheet } from "../../lib/Sheet.ts";
import { RegisterIntro } from "../../lib/Intro.ts";
import { RegisterFragment } from "../../lib/Fragments.ts";
import { LoadCss } from "../../lib/Templates.ts";

import { onRenderMessage } from "./Chat.ts";
import { LightbearerCharacterSheet } from "./Character.ts";
import { LightbearerCreatorRender } from "./Creator.ts";
import { RollsFragmentRender } from "./Rolls.ts";
import LightbearerCss from "./Lightbearer.css?raw";
import CharacterHtml from "./Character.html?raw";
import CreatorHtml from "./Creator.html?raw";
import AbilityFragment from "./Ability.html?raw";
import RollsFragment from "./Rolls.html?raw";


export async function init() {
    LoadCss("LightbearerCss", LightbearerCss);
    RegisterSheet("character.default", LightbearerCharacterSheet, CharacterHtml);
    RegisterIntro(LightbearerCreatorRender, CreatorHtml);
    RegisterFragment("ability", AbilityFragment);
    RegisterFragment("rolls", RollsFragment, RollsFragmentRender);
    Events.register("renderMessage", onRenderMessage);
}
