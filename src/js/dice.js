/**
 * @param {Number} n Number of sides on the dice
 * @param {Number} m Number of dice rolled
 *
 * @return {Number} the average of rolling m n-sided dice
 */
export function DropLowestAverage(n, m) {
    return m / (m + 1) * n + 0.5;
}
