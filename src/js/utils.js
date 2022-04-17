import { Vector2 } from "./vector.js";


export function IsDefined(value) {
    return typeof (value) !== "undefined";
}


export function PageCenter() {
    return new Vector2(window.innerWidth, window.innerHeight);
}


export function Parameter() {
    for (let argument of arguments) {
        if (typeof (argument) !== "undefined") {
            return argument;
        }
    }
    return undefined;
}


export function Require(argument) {
    if (typeof (argument) === "undefined") {
        throw new Error("Required parameter missing.")
    }
    return argument;
}
