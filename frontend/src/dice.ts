import { PCG } from "./pcg-random.ts";


declare const math: any;


export function Roll(formula: string, data = null, results = null) {
    if (data === null) {
        data = {};
    }
    if (results === null) {
        results = { total: 0, rolls: [] };
    }

    // Find all top level sub-expressions
    const expressions = [];
    let start;
    let depth = 0;
    for (let i = 0; i < formula.length; i++) {
        const character = formula[i];
        if (character == '(') {
            if (depth == 0) {
                start = i;
            }
            depth += 1;
        }
        else if (character == ')') {
            if (depth == 0) {
                throw new Error("Mismatched parens in formula: extra close paren");
            }
            depth -= 1;
            if (depth == 0) {
                expressions.push([start, i + 1]);
            }
        }
    }
    if (depth != 0) {
        throw new Error("Mismatched parens in formula: not enough close parens");
    }

    // If there are no sub-expressions, just evaluate the whole thing
    if (expressions.length == 0) {
        return FlatRoll(formula, data, results);
    }

    // Build a new formula sans sub-expressions
    let simplifiedFormula = "";
    let previousStop = 0;
    for (const [start, stop] of expressions) {
        simplifiedFormula += formula.substring(previousStop, start);
        simplifiedFormula += Roll(formula.substring(start + 1, stop - 1), data, results).total;
        previousStop = stop;
    }
    simplifiedFormula += formula.substring(previousStop);
    return FlatRoll(simplifiedFormula, data, results);
}


function FlatRoll(formula: string, data, results) {
    const diceResolvedFormula = formula.replaceAll(/([0-9]*)d([0-9]+)(d[0-9]+)?/g, (_, numDice, dieSize, dropped) => {
        // Parse input parameters into numbers
        if (numDice == "") {
            numDice = 1;
        }
        else {
            numDice = parseInt(numDice);
        }
        dieSize = parseInt(dieSize);
        if (dropped) {
            dropped = parseInt(dropped.substring(1));
        }
        else {
            dropped = 0;
        }

        // Roll dice
        const rolls = [];
        for (let i = 0; i < numDice; i++) {
            const roll = { result: PCG.randBelow(dieSize) + 1, sides: dieSize };
            rolls.push(roll);
            results.rolls.push(roll);
        }

        // Drop lowest
        rolls.sort((a, b) => b.result - a.result);
        for (let i = 0; i < dropped; i++) {
            const roll = rolls.pop();
            roll.dropped = true;
        }

        // Sum results
        let rollTotal = 0;
        for (const roll of rolls) {
            rollTotal += roll.result;
        }
        return rollTotal.toString();
    });

    results.total = math.evaluate(diceResolvedFormula, data);
    return results;
}
