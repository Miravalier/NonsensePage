export { Fragments } from "./fragment.ts";
import { RegisterFragment } from "./fragment.ts";


import AbilityFragment from "./ability.html?raw";
RegisterFragment("ability", AbilityFragment);

import RollsFragment from "./rolls.html?raw";
import { RollsFragmentRender } from "./rolls.ts";
RegisterFragment("rolls", RollsFragment, RollsFragmentRender);
