import * as Events from "../../lib/Events.ts";
import { RegisterSheet } from "../../lib/Sheet.ts";
import { RegisterIntro } from "../../lib/Intro.ts";
import { RegisterFragment } from "../../lib/Fragments.ts";
import { LoadCss } from "../../lib/Templates.ts";

import { onRenderMessage } from "./Chat.ts";
import { LightbearerAbilitySheet, onRenderAbilityEntry, onAbilityContextMenu } from "./Ability.ts";
import { LightbearerCharacterSheet } from "./Character.ts";
import { LightbearerCreatorRender } from "./Creator.ts";
import { RollsFragmentRender } from "./Rolls.ts";
import LightbearerCss from "./Lightbearer.css?raw";
import CharacterHtml from "./Character.html?raw";
import CreatorHtml from "./Creator.html?raw";
import AbilityHtml from "./Ability.html?raw";
import ItemFragmentHtml from "./ItemFragment.html?raw";
import RollsFragment from "./Rolls.html?raw";


export async function init() {
    LoadCss("LightbearerCss", LightbearerCss);
    RegisterSheet("character.default", LightbearerCharacterSheet, CharacterHtml);
    RegisterSheet("ability.default", LightbearerAbilitySheet, AbilityHtml);
    RegisterIntro(LightbearerCreatorRender, CreatorHtml);
    RegisterFragment("ability", AbilityHtml);
    RegisterFragment("item", ItemFragmentHtml);
    RegisterFragment("rolls", RollsFragment, RollsFragmentRender);
    Events.register("renderMessage", onRenderMessage);
    Events.register("renderAbilityEntry", onRenderAbilityEntry);
    Events.register("ability.context.entry", onAbilityContextMenu);
}
