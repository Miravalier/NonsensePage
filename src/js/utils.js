export function Parameter() {
    for (let argument of arguments) {
        if (typeof (argument) !== "undefined") {
            return argument;
        }
    }
    return undefined;
}
