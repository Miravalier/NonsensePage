import * as Dice from "../../lib/Dice.ts";
import { PCG } from "../../lib/PcgRandom.ts";
import { Ability, AbilityType, CharacterAbility, Roll, RollType } from "../../lib/Models.ts";


export function GetAbilityIcons(ability: Ability | CharacterAbility) {
    let icons = "";
    const typeIcon = {
        [AbilityType.Free]: "fa-regular fa-circle",
        [AbilityType.Action]: "fa-solid fa-circle-a",
        [AbilityType.Reaction]: "fa-duotone fa-exclamation-circle",
    }[ability.type];
    if (typeIcon) {
        icons += '<div class="icon">';
        icons += `<i class="${typeIcon}"></i>`;
        icons += '</div>';
    }
    if (ability.cooldown > 0) {
        icons += '<div class="icon">';
        icons += `<span class="cooldown">${ability.cooldown}</span>`;
        icons += `<i class="fa-solid fa-hourglass"></i>`;
        icons += '</div>';
    }
    return icons;
}


export function RenderRolls(rolls: Roll[]): string {
    let result = "";
    for (const roll of rolls) {
        let subresult = `<div class="${roll.type} roll">`;
        subresult += `<div class="label">${roll.label}</div>`;
        if (roll.type == RollType.Text) {
            subresult += `<div class="result">${roll.formula}</div>`;
        }
        else if (roll.type == RollType.Dice) {
            const rollResults = Dice.Roll(roll.formula);
            subresult += `<div class="result" data-category="${roll.type}" data-formula="${roll.formula}" data-dice="${btoa(JSON.stringify(rollResults.rolls))}">${rollResults.total}</div>`;
        }
        else if (roll.type == RollType.Table) {
            const choiceResult = PCG.choice(roll.formula.split(/ *, */));
            subresult += `<div class="result">${choiceResult}</div>`;
        }
        else if (roll.type == RollType.Damage || roll.type == RollType.Healing || roll.type == RollType.Shield) {
            const rollResults = Dice.Roll(roll.formula);
            subresult += `<div class="result" data-category="${roll.type}" data-formula="${roll.formula}" data-dice="${btoa(JSON.stringify(rollResults.rolls))}">${rollResults.total}</div>`;
        }
        subresult += '</div>';
        result += subresult;
    }
    return result;
}
