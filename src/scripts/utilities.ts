import { PcgEngine } from "./pcg-random";

const engine = new PcgEngine();

const alpha = [
    "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
    "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
    "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
]

const alphaNumeric = [
    "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
    "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
    "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
    "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
];

export function randomID(length?: number): string {
    if (!length) {
        length = 16;
    }
    let result = engine.choice(alpha);
    for (let i = 1; i < length; i++) {
        result += engine.choice(alphaNumeric);
    }
    return result;
}

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = MS_PER_SECOND * 60;
const MS_PER_HOUR = MS_PER_MINUTE * 60;
const MS_PER_DAY = MS_PER_HOUR * 24;
const MS_PER_YEAR = MS_PER_DAY * 365;

export function pluralize(amount: number, label: string) {
    if (amount === 1) {
        return `${amount} ${label}`;
    }
    else {
        return `${amount} ${label}s`;
    }
}

export function timeBetween(a: Date, b: Date): string {
    let ms = Math.abs(a.getTime() - b.getTime());
    // Factor out years
    const years = Math.floor(ms / MS_PER_YEAR);
    ms -= (years * MS_PER_YEAR);
    // Factor out days
    const days = Math.floor(ms / MS_PER_DAY);
    ms -= (days * MS_PER_DAY);
    // Factor out hours
    const hours = Math.floor(ms / MS_PER_HOUR);
    ms -= (hours * MS_PER_HOUR);
    // Factor out minutes
    const minutes = Math.floor(ms / MS_PER_MINUTE);
    ms -= (minutes * MS_PER_MINUTE);
    // Factor out seconds
    const seconds = Math.floor(ms / MS_PER_SECOND);
    ms -= (seconds * MS_PER_SECOND);
    // Construct string
    if (years > 0) {
        return `${pluralize(years, "year")} ${pluralize(days, "day")}`;
    }
    else if (days > 0) {
        return `${pluralize(days, "day")} ${pluralize(hours, "hour")}`;
    }
    else if (hours > 0) {
        return `${pluralize(hours, "hour")} ${pluralize(minutes, "minute")}`;
    }
    else if (minutes > 0) {
        return `${pluralize(minutes, "minute")} ${pluralize(seconds, "second")}`;
    }
    else {
        return `${pluralize(seconds, "second")}`;
    }
}


const currentDateString = new Date().toLocaleDateString();


export function displayDate(date: Date) {
    const dateString = date.toLocaleDateString();
    if (dateString !== currentDateString) {
        return dateString + " " +
            date.toLocaleTimeString(undefined, { hour12: false });
    }
    else {
        return date.toLocaleTimeString(undefined, { hour12: false });
    }
}
