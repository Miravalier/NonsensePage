function die(rolls, sides) {
    let result = 0;
    for (let i=0; i < rolls; i++) {
        result += Math.floor(Math.random() * sides) + 1;
    }
    return result;
}

function count_parens(formula) {
    let open = 0;
    let close = 0;

    let open_match = formula.match(/\(/g);
    if (open_match) {
        open = open_match.length;
    }
    let close_match = formula.match(/\)/g);
    if (close_match) {
        close = close_match.length;
    }

    return [open, close];
}

export function roll(formula) {
    let [open, close] = count_parens(formula);
    while (open || close)
    {
        if (open != close) {
            throw new Error("mismatched parentheses");
        }
        formula = formula.replace(/\([^()]*\)/g, match => {
            return roll(match.substr(1, match.length-2)).toString();
        });
        [open, close] = count_parens(formula);
    }

    // Substitute out dice rolls
    formula = formula.replace(/[0-9]*d[0-9]+/g, match => {
        let [rolls, sides] = match.split('d');
        if (rolls == "") {
            rolls = 1;
        }
        else {
            rolls = parseInt(rolls);
        }
        sides = parseInt(sides);
        return die(rolls, sides).toString();
    });

    // Check for non math things before eval
    let index = formula.search(/[^0-9+*\/%&|-]+/);
    if (index != -1) {
        throw new Error(`unrecognized symbol '${formula[index]}' in formula`);
    }

    return eval(formula);
}
