export { Fragments } from "./fragment.ts";
import { RegisterFragment } from "./fragment.ts";


import AbilityFragment from "./ability.html?raw";
RegisterFragment("ability", AbilityFragment);

import RollsFragment from "./rolls.html?raw";
import { RollsFragmentRender } from "./rolls.ts";
RegisterFragment("rolls", RollsFragment, RollsFragmentRender);

import LightbearerCreatorFragment from "./lightbearer_cc.html?raw";
import { LightbearerCreatorRender } from "./lightbearer_cc.ts";
RegisterFragment("lightbearer_cc", LightbearerCreatorFragment, LightbearerCreatorRender);
