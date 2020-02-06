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
    console.log(formula);
    let [open, close] = count_parens(formula);
    while (open || close)
    {
        if (open != close) {
            throw "mismatched parentheses";
        }
        let formula = formula.replace(/\([^()]*\)/g, match => {
            return roll(match.substr(1, match.length-2));
        });
        [open, close] = count_parens(formula);
    }
    return "<" + formula + ">";
}
