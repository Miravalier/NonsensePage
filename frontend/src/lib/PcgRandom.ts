/*
 * This PCG random number generator implementation uses Melissa O'Neill's
 * algorithm described at http://www.pcg-random.org/
 */
export class PcgEngine {
    state: bigint;
    inc: bigint;

    constructor(seed = undefined, inc = undefined) {
        if (seed === null && inc === null) {
            return;
        }
        if (seed === undefined && inc === undefined) {
            const values = new BigUint64Array(2);
            crypto.getRandomValues(values);
            seed = values[0];
            inc = values[1];
        }
        else if (seed === undefined) {
            const values = new BigUint64Array(1);
            crypto.getRandomValues(values);
            seed = values[0];
        }
        else if (inc === undefined) {
            const values = new BigUint64Array(1);
            crypto.getRandomValues(values);
            inc = values[0];
        }
        this.setSeed(seed, inc);
    }

    next(): bigint {
        const oldState = this.state;
        this.state = BigInt.asUintN(64, (oldState * 6364136223846793005n) + this.inc);
        const xorShifted = BigInt.asUintN(32, ((oldState >> 18n) ^ oldState) >> 27n);
        const rot = BigInt.asUintN(32, oldState >> 59n);
        return BigInt.asUintN(32, (xorShifted >> rot) | (xorShifted << ((-rot) & 31n)));
    }

    /**
     * Creates a new PcgRandom from an existing one.
     * @returns A new PcgRandom.
     */
    child(): PcgEngine {
        return new PcgEngine(this.randInt64(), this.randInt64());
    }

    /**
     * Creates a new engine with a copy of the current state.
     */
    copy(): PcgEngine {
        const engine = new PcgEngine(null, null);
        engine.state = this.state;
        engine.inc = this.inc;
        return engine;
    }

    /**
     * Sets the seed for the generator.
     * @param seed state initializer
     * @param inc stream id
     */
    setSeed(seed: bigint, inc: bigint) {
        this.state = 0n;
        this.inc = BigInt.asUintN(64, (inc << 1n) | 1n);
        this.next();
        this.state += seed;
        this.next();
    }

    /**
     * @returns A random uint32 Number.
     */
    randInt(): number {
        return Number(this.next());
    }

    /**
     * @returns A random uint64 BigInt.
     */
    randInt64(): bigint {
        return this.next() | (this.next() << 32n);
    }

    /**
     * Generates a random Number between 0 (inclusive) and a given max (exclusive).
     * @param max Integer limit (exclusive). Must fit in a uint32.
     * @returns A uint32 in the range [0, max).
     */
    randBelow(max: number): number {
        const bigMax = BigInt(max);
        const threshold = 0x100000000n % bigMax;
        while (true) {
            const result = this.next();
            if (result >= threshold) {
                return Number(result % bigMax);
            }
        }
    }

    /**
     * Generates a random number between min (inclusive) and max (exclusive).
     * @param min Lowest possible number (inclusive). Must fit in a uint32.
     * @param max Integer limit (exclusive). Must fit in a uint32.
     * @returns A uint32 in the range [min, max).
     */
    randBetween(min: number, max: number): number {
        return min + this.randBelow(max - min);
    }

    /**
     * @returns A double in the range of [0.0, 1.0)
     */
    randFloat(): number {
        return Number(this.randInt64()) / Number(1n << 64n);
    }

    /**
     * Picks a random element out of an array.
     */
    choice<T>(array: T[]): T {
        return array[this.randBelow(array.length)];
    }

    /**
     * Shuffles a given array in-place.
     * @param array The array to shuffle.
     */
    shuffle(array: any[]) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = this.randBelow(i + 1);
            const tmp = array[i];
            array[i] = array[j];
            array[j] = tmp;
        }
    }
}

export const PCG = new PcgEngine();
