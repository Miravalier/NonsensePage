import * as ContextMenu from "../../lib/ContextMenu.ts";
import { CharacterAbility, Roll, RollType } from "../../lib/Models.ts";

export function RollsFragmentRender(element: HTMLDivElement, ability: CharacterAbility) {
    const rollsContainer = element.querySelector<HTMLDivElement>(".rolls-fragment");

    const displayRoll = (roll: Roll) => {
        const rollElement = rollsContainer.appendChild(document.createElement("div"));
        rollElement.className = "roll";
        const typeElement = rollElement.appendChild(document.createElement("select"));
        typeElement.innerHTML = `
            <option value="text">Text</option>
            <option value="dice">Misc Dice</option>
            <option value="table">Table</option>
            <option value="damage">Damage</option>
            <option value="healing">Healing</option>
            <option value="shield">Shield</option>
            <option value="choice">Choice</option>
        `;
        const labelElement = rollElement.appendChild(document.createElement("input"));
        labelElement.type = "text";
        const formulaElement = rollElement.appendChild(document.createElement("input"));
        formulaElement.type = "text";

        typeElement.value = roll.type;
        typeElement.addEventListener("change", () => {
            roll.type = typeElement.value as RollType;
        });

        labelElement.value = roll.label;
        labelElement.addEventListener("change", () => {
            roll.label = labelElement.value;
        });

        formulaElement.value = roll.formula;
        formulaElement.addEventListener("change", () => {
            roll.formula = formulaElement.value;
        });

        ContextMenu.set(rollElement, {
            "Roll": {
                "Delete": () => {
                    const index = ability.rolls.indexOf(roll);
                    ability.rolls.splice(index, 1);
                    rollElement.remove();
                }
            }
        });
    };

    for (const roll of ability.rolls) {
        displayRoll(roll);
    }

    element.querySelector<HTMLButtonElement>(".add-roll")?.addEventListener("click", () => {
        const roll: Roll = { type: RollType.Dice, label: "", formula: "" };
        ability.rolls.push(roll);
        displayRoll(roll);
    });
}
