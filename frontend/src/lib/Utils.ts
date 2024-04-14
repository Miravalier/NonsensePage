import { Session } from "./Requests.ts";
import { PcgEngine } from "./PcgRandom.ts";
import { Vector2 } from "./Vector.ts";
import { Permissions } from "./Enums.ts";
import { Entry } from "./Models.ts";
import * as Database from "./Database.ts";


export function ColorIntToVec3(value: number): [number, number, number] {
    return [
        ((value & 0xFF0000) >>> 16) / 255,
        ((value & 0xFF00) >>> 8) / 255,
        (value & 0xFF) / 255
    ]
}


export function ColorIntToVec4(value: number): [number, number, number, number] {
    return [
        ((value & 0xFF000000) >>> 24) / 255,
        ((value & 0xFF0000) >>> 16) / 255,
        ((value & 0xFF00) >>> 8) / 255,
        (value & 0xFF) / 255
    ]
}


export function GenerateId(): string {
    const values = new Uint8Array(12);
    crypto.getRandomValues(values);
    let result = "";
    for (const byte of values) {
        result += byte.toString(16).padStart(2, '0');
    }
    return result;
}

export class LocalPersist {
    static save(identifier: string, obj: any) {
        localStorage.setItem(identifier, JSON.stringify(obj));
    }

    static load<T>(identifier: string, defaultValue: T = null): T {
        const storedJson = localStorage.getItem(identifier);
        if (!storedJson) {
            return defaultValue;
        }
        return JSON.parse(storedJson);
    }
}


export function InflateDocument(document: any) {
    if (Array.isArray(document) || document === null || typeof document !== "object") {
        return document;
    }

    const result = {};
    for (const [key, value] of Object.entries(document)) {
        let cursor = result;
        const components = key.split(".");
        const terminal = components.pop();
        for (const component of components) {
            if (typeof cursor[component] === "undefined") {
                cursor[component] = {};
            }
            cursor = cursor[component];
        }
        cursor[terminal] = InflateDocument(value);
    }
    return result;
}


export function SetPath(object: any, path: string, value: any) {
    const components = path.split(".");
    const finalComponent = components.pop();

    let cursor = object;
    for (const component of components) {
        if (!cursor[component]) {
            cursor[component] = {};
        }
        cursor = cursor[component];
    }

    cursor[finalComponent] = value;
}


export function ResolvePath(object: any, path: string) {
    if (!object || !path) {
        return undefined;
    }

    let result = object;
    for (const component of path.split(".")) {
        if (!result) {
            return undefined;
        }
        if (typeof result != "object") {
            return undefined;
        }
        result = result[component];
    }
    return result;
}


export function GetPermissions(document: Entry, id: string = null, field: string = "*"): number {
    if (Session.gm) {
        return Permissions.OWNER;
    }
    if (id === null) {
        id = Session.id;
    }

    if (!document || !document.permissions) {
        console.error(document);
        throw new Error("Invalid document does not contain permissions");
    }

    // Find the permissions sub-document appropriate for this entity
    let entityPermissions;
    if (document.permissions[id]) {
        entityPermissions = document.permissions[id];
    }
    else if (document.permissions["*"]) {
        entityPermissions = document.permissions["*"];
    }
    else {
        entityPermissions = { "*": Permissions.INHERIT };
    }

    // Get the permission for this specific field
    let permission;
    if (entityPermissions[field]) {
        permission = entityPermissions[field];
    }
    else if (entityPermissions["*"]) {
        permission = entityPermissions["*"];
    }
    else {
        permission = Permissions.INHERIT;
    }

    // Resolve inherited permissions
    if (permission == Permissions.INHERIT) {
        if (id == "*") {
            return Permissions.NONE;
        }
        else {
            return GetPermissions(document, "*", field);
        }
    }

    return permission;
}


export function HasPermission(document: Entry, id: string, field: string, level: number = Permissions.READ): boolean {
    return GetPermissions(document, id, field) >= level;
}


export function ContainsOperators(data: any): boolean {
    if (!data) {
        return false;
    }

    if (Array.isArray(data)) {
        for (let value of data) {
            if (ContainsOperators(value)) {
                return true;
            }
        }
        return false;
    }

    if (typeof data == "object") {
        for (let [key, value] of Object.entries(data)) {
            if (key.startsWith("$")) {
                return true;
            }
            else if (ContainsOperators(value)) {
                return true;
            }
        }
        return false;
    }

    return false;
}


export function AddDragListener(element: HTMLElement, data: any) {
    element.draggable = true;
    element.addEventListener("dragstart", (ev) => {
        ev.dataTransfer.setData("application/nonsense", JSON.stringify(data));
        if (data.img) {
            const image = new Image();
            image.src = data.img;
            ev.dataTransfer.setDragImage(image, 16, 16);
        }
    });
}


export function AddDropListener(element: HTMLElement, fn: CallableFunction): AbortController {
    const abortController = new AbortController();

    element.addEventListener("dragover", (ev) => {
        ev.dataTransfer.dropEffect = "copy";
        ev.preventDefault();
    }, { signal: abortController.signal });

    element.addEventListener("drop", (ev) => {
        let dragData;
        try {
            dragData = JSON.parse(ev.dataTransfer.getData("application/nonsense"));
        } catch (error) {
            dragData = null;
        }

        if (dragData) {
            fn(dragData, ev);
        }
    }, { signal: abortController.signal });

    return abortController;
}


export function DerivePcgEngine(id: string) {
    return new PcgEngine(
        BigInt(parseInt(id.slice(0, 6), 36)),
        BigInt(parseInt(id.slice(6, 12), 36))
    );
}


export function PathConcat(a: string, b: string): string {
    if (a.endsWith("/")) {
        return a + b;
    }
    else {
        return a + "/" + b;
    }
}


export function Parent(path: string): string {
    const lastSlashIndex = path.lastIndexOf("/");
    if (lastSlashIndex == -1) {
        return path;
    }

    return path.substring(0, lastSlashIndex + 1);
}


export function Leaf(path: string): string {
    const lastSlashIndex = path.lastIndexOf("/");
    if (lastSlashIndex == -1) {
        return path;
    }

    return path.substring(lastSlashIndex + 1);
}

export function GetSpeaker() {
    const user = Database.users[Session.id];
    if (user.character) {
        return user.character;
    }
    else {
        return user;
    }
}


export function EscapeHtml(message) {
    const div = document.createElement("div");
    div.textContent = message;
    return div.innerHTML;
}


export function Bound(min: number, value: number, max: number): number {
    return Math.min(Math.max(min, value), max);
}


export function StringBound(s: string, maxLength: number): string {
    if (s.length <= maxLength) {
        return s;
    }
    else if (maxLength < 10) {
        return s.slice(0, maxLength);
    }
    else {
        return s.slice(0, maxLength - 3) + "...";
    }
}


export function IsDefined(value: any): boolean {
    return typeof (value) !== "undefined";
}


export function PageCenter(): Vector2 {
    return new Vector2(window.innerWidth, window.innerHeight);
}


export function Parameter<T>(...values: T[]): T {
    for (let value of values) {
        if (typeof (value) !== "undefined") {
            return value;
        }
    }
    return undefined;
}


export function Require<T>(argument: T): T {
    if (typeof (argument) === "undefined") {
        throw new Error("Required parameter missing.")
    }
    return argument;
}


export async function GetThumbnail(url: string): Promise<string> {
    const encoder = new TextEncoder();
    let thumbnail = "/thumbnails/";
    for (let byte of new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(url)))) {
        thumbnail += byte.toString(16).padStart(2, '0');
    }
    thumbnail += ".png";
    return thumbnail;
}


const FREQUENCIES = [
    0.075187970,
    0.015037594,
    0.028195489,
    0.041353383,
    0.112781955,
    0.023496241,
    0.015977444,
    0.060150376,
    0.075187970,
    0.003759398,
    0.007518797,
    0.037593985,
    0.028195489,
    0.075187970,
    0.075187970,
    0.015977444,
    0.004699248,
    0.058270677,
    0.075187970,
    0.084586466,
    0.031954887,
    0.011278195,
    0.018796992,
    0.003759398,
    0.018796992,
    0.001879699,
]
const LETTERS = "abcdefghijklmnopqrstuvwxyz";
const LETTER_FREQUENCIES = [];
let LETTER_FREQUENCY_SUM = 0;
for (let i = 0; i < FREQUENCIES.length; i++) {
    LETTER_FREQUENCY_SUM += FREQUENCIES[i];
    LETTER_FREQUENCIES.push([LETTER_FREQUENCY_SUM, LETTERS[i]]);
}

export function RandomLetter(engine: PcgEngine): string {
    const value = engine.randFloat();
    for (const [limit, letter] of LETTER_FREQUENCIES) {
        if (value < limit) {
            return letter;
        }
    }
    // Most common letter for weird edge cases
    return 'e';
}


export function RandomText(engine: PcgEngine, length: number): string {
    let result = "";
    for (let i = 0; i < length; i++) {
        result += RandomLetter(engine);
    }
    return result;
}


export function LoremIpsum(): string {
    return `
        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt
        ut labore et dolore magna aliqua. Elementum curabitur vitae nunc sed velit dignissim
        sodales ut eu. Porta nibh venenatis cras sed felis eget velit. Metus aliquam eleifend mi
        in nulla posuere sollicitudin aliquam ultrices. Eu turpis egestas pretium aenean.
        Adipiscing elit duis tristique sollicitudin nibh sit amet. Amet est placerat in egestas.
        Potenti nullam ac tortor vitae purus faucibus ornare suspendisse sed. Nulla aliquet enim
        tortor at auctor urna nunc id cursus. Egestas sed tempus urna et. Vestibulum lectus mauris
        ultrices eros in cursus turpis. Odio ut sem nulla pharetra diam sit. Eu non diam phasellus
        vestibulum lorem. Est pellentesque elit ullamcorper dignissim cras tincidunt. Fames ac
        turpis egestas sed. Auctor neque vitae tempus quam pellentesque nec nam aliquam.
        Viverra mauris in aliquam sem fringilla ut. Arcu dictum varius duis at. Convallis convallis
        tellus id interdum velit laoreet. Sed cras ornare arcu dui vivamus arcu felis bibendum.
        Faucibus purus in massa tempor nec feugiat nisl pretium. Cursus vitae congue mauris rhoncus
        aenean vel elit. Lacus luctus accumsan tortor posuere. Lacus sed viverra tellus in hac.
        Viverra orci sagittis eu volutpat odio facilisis mauris. Cursus eget nunc scelerisque
        viverra mauris in aliquam sem fringilla. Quis risus sed vulputate odio ut enim blandit
        volutpat maecenas. Libero enim sed faucibus turpis in. Praesent tristique magna sit amet
        purus. Amet nisl suscipit adipiscing bibendum est ultricies.
        Vel facilisis volutpat est velit egestas dui id ornare. Egestas erat imperdiet sed euismod
        nisi porta lorem. Congue nisi vitae suscipit tellus mauris a. Semper feugiat nibh sed
        pulvinar proin gravida hendrerit lectus. Volutpat maecenas volutpat blandit aliquam etiam
        erat. Cras tincidunt lobortis feugiat vivamus at augue eget arcu dictum. Sit amet dictum
        sit amet. Dis parturient montes nascetur ridiculus mus mauris. Hendrerit dolor magna eget
        est lorem. Feugiat nisl pretium fusce id velit ut tortor pretium viverra. Mi bibendum neque
        egestas congue quisque egestas diam in. Adipiscing commodo elit at imperdiet dui accumsan
        sit. Dictum sit amet justo donec enim diam. Donec et odio pellentesque diam volutpat commodo
        sed. At tellus at urna condimentum mattis pellentesque. Tortor pretium viverra suspendisse
        potenti nullam ac. Mauris cursus mattis molestie a iaculis. Orci porta non pulvinar neque
        laoreet suspendisse interdum consectetur libero. Malesuada fames ac turpis egestas integer
        eget aliquet nibh. Sapien nec sagittis aliquam malesuada bibendum.
        In iaculis nunc sed augue. Ut faucibus pulvinar elementum integer enim. Felis eget velit
        aliquet sagittis id. Ornare suspendisse sed nisi lacus sed. Dictum varius duis at consectetur
        lorem. Ut diam quam nulla porttitor massa id. Tempus urna et pharetra pharetra massa. Nunc
        sed velit dignissim sodales ut eu sem integer vitae. Sollicitudin tempor id eu nisl nunc.
        Vitae proin sagittis nisl rhoncus. Tortor id aliquet lectus proin nibh nisl condimentum.
        Eros donec ac odio tempor. Malesuada fames ac turpis egestas maecenas pharetra convallis.
        Malesuada fames ac turpis egestas maecenas pharetra convallis posuere morbi. Diam ut
        venenatis tellus in. Enim facilisis gravida neque convallis a cras semper auctor. In
        tellus integer feugiat scelerisque varius.
        Morbi tristique senectus et netus. Senectus et netus et malesuada fames ac. Ultricies
        mi eget mauris pharetra et ultrices neque ornare. Ante in nibh mauris cursus mattis
        molestie. Blandit massa enim nec dui nunc mattis enim ut. Mi sit amet mauris commodo
        quis imperdiet. Quisque sagittis purus sit amet. Nullam vehicula ipsum a arcu cursus
        vitae congue mauris rhoncus. Tortor dignissim convallis aenean et tortor at risus.
        Amet venenatis urna cursus eget nunc scelerisque. Tempus imperdiet nulla malesuada
        pellentesque elit eget gravida cum. Fusce id velit ut tortor pretium. Vel elit
        scelerisque mauris pellentesque. Risus viverra adipiscing at in. Ac turpis egestas
        sed tempus urna et pharetra pharetra. Senectus et netus et malesuada fames ac turpis
        egestas.
    `;
}
