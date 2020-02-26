const MASK64 = 18446744073709551615n;
const MASK32 = 4294967295n;
const MULTIPLIER = 6364136223846793005n;
const INCREMENT  = 1442695040888963407n;
const RAND_MAX = 4294967295;

function rotr32(x, r)
{
	return (x >> r | x << (-r & 31n)) & MASK32;
}

export class PCG {
    // Takes a BigInt
    constructor(seed) {
        if (seed || seed == 0) {
            this.state = (seed + INCREMENT) & MASK64;
            this.next();
        }
    }

    // Returns [0, 2**32) as Number
    next() {
        let value = this.state;
        let count = value >> 59n;

        this.state = (value * MULTIPLIER + INCREMENT) & MASK64;
        value ^= value >> 18n;
        return Number(rotr32(value >> 27n, count));
    }

    // Returns [min, max] as Number
    between(min, max) {
        return this.below(max+1-min) + min;
    }

    // Returns [0, limit) as Number
    below(limit) {
        let reroll_threshold = RAND_MAX - RAND_MAX % limit;

        let value = this.next();
        while (value >= reroll_threshold) {
            value = this.next();
        }

        return value % limit;
    }
}

function die(rolls, sides, generator) {
    let result = 0;
    for (let i=0; i < rolls; i++) {
        result += generator.below(sides) + 1;
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

export function roll(formula, generator) {
    let [open, close] = count_parens(formula);
    if (open != close) {
        throw new Error("mismatched parentheses");
    }
    formula = formula.replace(/\([^()]*\)/g, match => {
        return roll(match.substr(1, match.length-2), generator).toString();
    });

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
        return die(rolls, sides, generator).toString();
    });

    // Check for non math things before eval
    let index = formula.search(/[^0-9+*\/%&|^-]+/);
    if (index != -1) {
        throw new Error(`unrecognized symbol '${formula[index]}' in formula`);
    }

    return eval(formula);
}
