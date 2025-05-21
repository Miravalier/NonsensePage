import * as ContextMenu from "../lib/ContextMenu.ts";
import * as Drag from "../lib/Drag.ts";
import * as Events from "../lib/Events.ts";
import * as Templates from "../lib/Templates.ts";
import { Button } from "../lib/Elements.ts";
import { Vector2 } from "../lib/Vector.ts";
import { Canvas } from "../lib/Canvas.ts";
import { ApiRequest, Session, Subscribe, Subscription } from "../lib/Requests.ts";
import {
    PageCenter,
    Parameter,
    Bound,
    StringBound,
    GenerateId,
} from "../lib/Utils.js";
import { Fragments } from "../lib/Fragments.ts";
import { Future } from "../lib/Async.ts";
import { AddDropListener } from "../lib/Drag.ts";


export type SerializedWindow = {
    type: string;
    left: number;
    top: number;
    right: number;
    bottom: number;
    data: any;
};


let nextZIndex = 0;

export const windows: { [id: string]: BaseWindow } = {};
export const WindowTypes: { [name: string]: { new(options: any): BaseWindow } } = {};

export function registerWindowType(type: { new(options: any): BaseWindow }) {
    WindowTypes[type.name] = type;
}

export class BaseWindow {
    size: Vector2;
    position: Vector2;
    classList: string[];
    on_close: CallableFunction[];
    subscriptions: Subscription[];
    abortControllers: AbortController[];
    events: [string, CallableFunction][];
    intervalIds: number[];
    windowId: string;
    minimized: boolean;
    fullscreen: boolean;
    container: HTMLDivElement;
    titleBar: HTMLDivElement;
    titleNode: HTMLDivElement;
    refreshButton: HTMLButtonElement;
    minimizeButton: HTMLButtonElement;
    fullscreenButton: HTMLButtonElement;
    closeButton: HTMLButtonElement;
    viewPort: HTMLDivElement;
    resizeHandle: HTMLDivElement;
    storedWidth: number;
    storedHeight: number;

    constructor({
        register = true,
        title = "",
        size = new Vector2(600, 400),
        position = undefined,
        backgroundColor = "#324051",
        classList = [],
        resizable = true,
        refreshable = false,
        popOut = false,
        noTitleBar = false,
    }) {
        if (popOut) {
            resizable = false;
        }

        this.size = size;
        this.position = Parameter<Vector2>(position, PageCenter().subtract(this.size).divide(2));
        classList.push("window");

        this.on_close = [];
        this.subscriptions = [];
        this.abortControllers = [];
        this.intervalIds = [];
        this.events = [];
        this.windowId = GenerateId();
        if (register) {
            windows[this.windowId] = this;
        }

        this.minimized = false;
        this.fullscreen = false;

        this.container = document.createElement("div");
        this.container.className = classList.join(" ");
        this.container.style.left = `${this.position.x}px`;
        this.container.style.top = `${this.position.y}px`;
        this.container.style.zIndex = (++nextZIndex).toString();
        if (backgroundColor !== null) {
            this.container.style.backgroundColor = backgroundColor;
        }

        this.container.addEventListener("mousedown", () => {
            if (parseInt(this.container.style.zIndex) != nextZIndex) {
                this.container.style.zIndex = (++nextZIndex).toString();
            }
        });

        if (noTitleBar) {
            this.titleBar = null;
        }
        else {
            const titleBar = this.container.appendChild(document.createElement("div"));
            this.titleBar = titleBar;
            titleBar.className = "titleBar";

            if (!popOut) {
                Drag.AddPositionalListener(titleBar, {
                    onStart: (ctx, ev) => {
                        ctx.xOffset = ev.clientX - this.container.offsetLeft;
                        ctx.yOffset = ev.clientY - this.container.offsetTop;
                        ctx.xMax = window.innerWidth - (Math.ceil(this.container.offsetWidth) + 1);
                        ctx.yMax = window.innerHeight - (Math.ceil(this.container.offsetHeight) + 1);
                    },
                    onMove: (ctx, ev) => {
                        this.position.x = Bound(0, ev.clientX - ctx.xOffset, ctx.xMax);
                        this.container.style.left = `${this.position.x}px`;
                        this.position.y = Bound(0, ev.clientY - ctx.yOffset, ctx.yMax);
                        this.container.style.top = `${this.position.y}px`;
                    },
                });

                if (resizable) {
                    titleBar.addEventListener("dblclick", () => {
                        this.toggleMinimize();
                    });
                }
            }

            this.titleNode = titleBar.appendChild(document.createElement("div"));
            this.titleNode.className = "group";
            this.setTitle(title);

            const rightGroup = titleBar.appendChild(document.createElement("div"));
            rightGroup.className = "group";
            rightGroup.addEventListener("dblclick", ev => {
                ev.stopPropagation();
            });

            if (refreshable) {
                this.refreshButton = rightGroup.appendChild(Button("refresh"));
                this.refreshButton.addEventListener("click", () => {
                    this.refresh();
                });
            }

            if (resizable) {
                this.minimizeButton = rightGroup.appendChild(Button("window-minimize"));
                this.minimizeButton.addEventListener("click", () => {
                    this.toggleMinimize();
                })

                this.fullscreenButton = rightGroup.appendChild(Button("expand-alt"));
                this.fullscreenButton.addEventListener("click", () => {
                    this.toggleFullscreen();
                });
            }

            this.closeButton = rightGroup.appendChild(Button("window-close"));
            this.closeButton.addEventListener("click", () => {
                this.close();
            });

            const contextOptions = {
                "Window": {
                    "Close": () => {
                        this.close();
                    },
                    "Pop Out": () => {
                        const windowData = btoa(JSON.stringify({ type: this.constructor.name, data: this.serialize() }));
                        window.open(`/?window=${windowData}`).focus();
                        this.close();
                    },
                }
            }
            if (Session.gm && register) {
                contextOptions["Window"]["Show to Players"] = async () => {
                    await this.onShare();
                    await ApiRequest("/show/window", { type: this.constructor.name, data: this.serialize() });
                };
            }
            ContextMenu.set(titleBar, contextOptions);
        }

        this.viewPort = this.container.appendChild(document.createElement("div"));
        this.viewPort.className = "viewPort";
        ContextMenu.set(this.viewPort, null);

        if (resizable) {
            this.viewPort.style.width = `${this.size.x}px`;
            this.viewPort.style.height = `${this.size.y}px`;
            const resizeHandle = this.container.appendChild(document.createElement("div"));
            this.resizeHandle = resizeHandle;
            resizeHandle.className = "resizeHandle";

            Drag.AddPositionalListener(resizeHandle, {
                onStart: (ctx, _ev) => {
                    ctx.xMax = window.innerWidth - (this.container.offsetLeft + this.viewPort.offsetLeft + 1);
                    ctx.yMax = window.innerHeight - (this.container.offsetTop + this.viewPort.offsetTop + 1);
                },
                onMove: (ctx, ev) => {
                    const xOffset = ev.clientX - this.container.offsetLeft;
                    const yOffset = ev.clientY - this.container.offsetTop;
                    let minWidth = 10;
                    if (this.titleBar) {
                        for (const group of this.titleBar.children) {
                            minWidth += group.clientWidth;
                        }
                    }
                    this.size.x = Bound(minWidth, xOffset, ctx.xMax);
                    this.size.y = Bound(40, yOffset, ctx.yMax);
                    this.viewPort.style.width = `${this.size.x}px`;
                    this.viewPort.style.height = `${this.size.y}px`;
                    this.onResizeStart();
                },
                onEnd: (_ctx, _ev) => {
                    this.onResizeStop();
                },
            });
        }
        else {
            this.resizeHandle = null;
        }

        const windowElements = document.querySelector("#windows");
        windowElements.appendChild(this.container);

        if (popOut) {
            if (this.titleBar) {
                this.titleBar.style.display = "none";
            }
            this.container.style.position = "unset";
            this.container.style.width = "100%";
            this.container.style.height = "100%";
            this.viewPort.style.width = "100%";
            this.viewPort.style.height = "100%";
            this.size.x = window.innerWidth;
            this.size.y = window.innerHeight;
            this.container.classList.add("popout");
            if (this.resizeHandle) {
                this.resizeHandle.style.display = "none";
            }
        }
    }

    async onShare() { }

    onResizeStart() { }

    onResizeStop() { }

    register(event: string, callback: CallableFunction) {
        Events.register(event, callback);
        this.events.push([event, callback]);
    }

    repeatFunction(func: CallableFunction, delay: number): number {
        const intervalId = setInterval(func, delay);
        this.intervalIds.push(intervalId);
        return intervalId;
    }

    setTitle(s: string) {
        if (this.titleBar) {
            this.titleNode.innerText = StringBound(s, 40);
        }
    }

    serialize(): any {
        return {};
    }

    async deserialize(_data: any) {
        await this.load();
    }

    addEventListener(element: HTMLElement, event: keyof HTMLElementEventMap, fn: (ev: Event) => void ) {
        const abortController = new AbortController();
        element.addEventListener(event, fn, { signal: abortController.signal });
        this.abortControllers.push(abortController);
    }

    addDropListener(element: HTMLElement, fn: CallableFunction) {
        this.abortControllers.push(AddDropListener(element, fn));
    }

    async subscribe(pool: string, callback: CallableFunction): Promise<Subscription> {
        const subscription = await Subscribe(pool, callback);
        this.subscriptions.push(subscription);
        return subscription;
    }

    async load(_: any = null) {
        for (let subscription of this.subscriptions) {
            subscription.cancel();
        }
        for (let controller of this.abortControllers) {
            controller.abort();
        }
        for (let intervalId of this.intervalIds) {
            clearInterval(intervalId);
        }
        for (let [event, callback] of this.events) {
            Events.deregister(event, callback);
        }
        this.subscriptions = [];
        this.abortControllers = [];
        this.intervalIds = [];
        this.events = [];
    }

    async refresh() {
        await this.load();
    }

    toggleFullscreen() {
        if (this.minimized) {
            this.toggleMinimize();
        }
        // Undo fullscreen
        if (this.fullscreen) {
            this.fullscreenButton.innerHTML = `<i class="fa-solid fa-expand-alt button"></i>`;
            this.container.style.position = null;
            this.container.style.width = null;
            this.container.style.height = null;
            this.viewPort.style.width = `${this.storedWidth}px`;
            this.viewPort.style.height = `${this.storedHeight}px`;
            this.size.x = this.storedWidth;
            this.size.y = this.storedHeight;
            if (this.resizeHandle) {
                this.resizeHandle.style.display = null;
            }
        }
        // Become fullscreen
        else {
            this.storedWidth = this.viewPort.offsetWidth;
            this.storedHeight = this.viewPort.offsetHeight;
            this.fullscreenButton.innerHTML = `<i class="fa-solid fa-compress-alt button"></i>`;
            this.container.style.position = "unset";
            this.container.style.width = "100%";
            this.container.style.height = "100%";
            this.viewPort.style.width = "100%";
            this.viewPort.style.height = "100%";
            this.size.x = window.innerWidth;
            this.size.y = window.innerHeight;
            if (this.resizeHandle) {
                this.resizeHandle.style.display = "none";
            }
        }
        this.fullscreen = !this.fullscreen;
    }

    toggleMinimize() {
        if (this.fullscreen) {
            this.toggleFullscreen();
        }
        // Undo minimize
        if (this.minimized) {
            this.viewPort.style.display = null;
            this.minimizeButton.innerHTML = `<i class="fa-solid fa-window-minimize button"></i>`;
            if (this.resizeHandle) {
                this.resizeHandle.style.display = null;
            }
        }
        // Become minimized
        else {
            this.viewPort.style.display = "none";
            this.minimizeButton.innerHTML = `<i class="fa-solid fa-window-maximize button"></i>`;
            if (this.resizeHandle) {
                this.resizeHandle.style.display = "none";
            }
        }
        this.minimized = !this.minimized;
    }

    close() {
        this.container.remove();
        for (let subscription of this.subscriptions) {
            subscription.cancel();
        }
        for (let callback of this.on_close) {
            callback()
        }
        for (let intervalId of this.intervalIds) {
            clearInterval(intervalId);
        }
        for (let [event, callback] of this.events) {
            Events.deregister(event, callback);
        }
        delete windows[this.windowId];
    }
}
registerWindowType(BaseWindow);


export class CanvasWindow extends BaseWindow {
    canvas: Canvas;
    options: any;
    canvasInitialized: boolean;
    loadingText: HTMLDivElement;

    constructor(options = undefined) {
        options = Parameter(options, {});
        super(options);
        const canvasClass = Parameter(options.canvasClass, Canvas);
        this.viewPort.className = "canvasViewPort";
        options.container = this.viewPort;
        this.canvas = new canvasClass(options);
        this.canvasInitialized = false;
        this.options = options;
        this.loadingText = this.viewPort.appendChild(document.createElement("div"));
        this.loadingText.className = "loadingText";
        this.loadingText.innerText = "Map Loading ...";
    }

    async load() {
        await super.load();
        if (!this.canvasInitialized) {
            await this.canvas.init(this.options);
            this.canvasInitialized = true;
        }
    }

    toggleFullscreen() {
        super.toggleFullscreen();
        this.canvas.view.width = this.viewPort.offsetWidth;
        this.canvas.view.height = this.viewPort.offsetHeight;
        this.canvas.onResize(this.viewPort.offsetWidth, this.viewPort.offsetHeight);
    }

    onResizeStart() {
        super.onResizeStart();
        this.canvas.view.style.display = "none";
        this.loadingText.style.display = "block";
    }

    onResizeStop() {
        super.onResizeStop();
        this.canvas.view.style.display = null;
        this.loadingText.style.display = null;
        this.canvas.view.width = this.viewPort.offsetWidth;
        this.canvas.view.height = this.viewPort.offsetHeight;
        this.canvas.onResize(this.viewPort.offsetWidth, this.viewPort.offsetHeight);
    }
}
registerWindowType(CanvasWindow);


export class ContentWindow extends BaseWindow {
    content: HTMLDivElement;

    constructor(options = undefined) {
        options = Parameter(options, {});
        super(options);
        this.content = this.viewPort.appendChild(document.createElement("div"));
        this.content.className = "content";
    }
}
registerWindowType(ContentWindow);


export class InvisibleWindow extends ContentWindow {
    constructor(options = undefined) {
        options = Parameter(options, {});
        options.resizable = Parameter(options.resizable, false);
        options.noTitleBar = Parameter(options.noTitleBar, true);
        options.backgroundColor = Parameter(options.backgroundColor, "#00000000");
        options.classList = Parameter(options.classList, []);
        options.classList.push("invisible");
        super(options);

        Drag.AddPositionalListener(this.content, {
            onStart: (ctx, ev) => {
                ctx.xOffset = ev.clientX - this.container.offsetLeft;
                ctx.yOffset = ev.clientY - this.container.offsetTop;
                ctx.xMax = window.innerWidth - (Math.ceil(this.container.offsetWidth) + 1);
                ctx.yMax = window.innerHeight - (Math.ceil(this.container.offsetHeight) + 1);
            },
            onMove: (ctx, ev) => {
                this.position.x = Bound(0, ev.clientX - ctx.xOffset, ctx.xMax);
                this.container.style.left = `${this.position.x}px`;
                this.position.y = Bound(0, ev.clientY - ctx.yOffset, ctx.yMax);
                this.container.style.top = `${this.position.y}px`;
            },
        });

        const contextOptions = {
            [options.title]: {
                "Close": () => {
                    this.close();
                },
            },
        };
        ContextMenu.set(this.content, contextOptions);
    }
}
registerWindowType(InvisibleWindow);


function AddElement(container: HTMLDivElement, element: HTMLElement | HTMLElement[]): HTMLElement {
    if (Array.isArray(element)) {
        const subcontainer = document.createElement("div");
        if (container.classList.contains("column")) {
            subcontainer.className = "row";
        }
        else {
            subcontainer.className = "column";
        }
        for (let subelement of element) {
            AddElement(subcontainer, subelement);
        }
        return container.appendChild(subcontainer);
    }
    else {
        return container.appendChild(element);
    }
}


export class Dialog extends ContentWindow {
    description: HTMLDivElement;
    elements: HTMLDivElement;

    constructor(options: any = undefined) {
        options = Parameter(options, {});
        // Default resizable to false instead of true
        options.resizable = Parameter(options.resizable, false);
        options.title = Parameter(options.title, "New Dialog");
        options.register = Parameter(options.register, false);
        super(options);
        this.content.classList.add("dialog");

        // Add description
        const descriptionText = Parameter(options.description, "");
        this.description = this.content.appendChild(document.createElement("div"));
        this.description.className = "description";
        this.description.appendChild(document.createTextNode(descriptionText));

        // Add sub elements
        const elements = Parameter(options.elements, []);
        this.elements = this.content.appendChild(document.createElement("div"));
        this.elements.className = "elements column";
        for (let element of elements) {
            AddElement(this.elements, element);
        }
    }
}
registerWindowType(Dialog);


export async function InputDialog(title: string, inputs: { [label: string]: any }, acceptText: string): Promise<{ [label: string]: any }> {
    const abortControllers: AbortController[] = [];
    const inputElements = [];
    for (const [labelText, inputData] of Object.entries(inputs)) {
        let inputType;
        let inputValue = "";
        let secondaryValue = null;
        if (Array.isArray(inputData)) {
            if (inputData.length == 1) {
                inputType = inputData[0];
            }
            if (inputData.length == 2) {
                [inputType, inputValue] = inputData;
            }
            else if (inputData.length == 3) {
                [inputType, inputValue, secondaryValue] = inputData;
            }
        }
        else {
            inputType = inputData;
        }

        const inputLabel = document.createElement("span");
        if (inputType !== "fragment") {
            inputLabel.classList.add("label");
            inputLabel.textContent = labelText;
        }
        let inputElement;
        if (inputType == "paragraph") {
            inputElement = document.createElement("textarea");
            inputElement.maxLength = 10000;
            inputElement.value = inputValue;
            abortControllers.push(AddDropListener(inputElement, async (dropData) => {
                if (dropData.type == "characterEntry") {
                    inputElement.value = inputElement.value + `\n[character:${dropData.id}]`;
                }
            }));
        }
        else if (inputType == "fragment") {
            inputElement = document.createElement("div");
            inputElement.classList.add("fragment");
            if (!inputValue || !secondaryValue) {
                throw Error("not enough parameters to InputDialog fragment");
            }
            const fragment = inputValue;
            const data = secondaryValue;
            const [fragmentTemplate, fragmentCallback] = Fragments[inputValue];
            const template = Templates.LoadTemplate("fragment-" + fragment, fragmentTemplate);
            inputElement.innerHTML = template(data);
            fragmentCallback(inputElement, data);
        }
        else if (inputType == "select") {
            inputElement = document.createElement("select");

            if (Array.isArray(inputValue)) {
                for (const option of inputValue) {
                    const optionElement = inputElement.appendChild(document.createElement("option"));
                    optionElement.value = option;
                    optionElement.innerText = option;
                }
            }
            else {
                for (const [option, optionLabel] of Object.entries(inputValue)) {
                    const optionElement = inputElement.appendChild(document.createElement("option"));
                    optionElement.value = option;
                    optionElement.innerText = optionLabel;
                }
            }

            if (secondaryValue) {
                inputElement.value = secondaryValue;
            }
        }
        else {
            inputElement = document.createElement("input");
            inputElement.type = inputType;
            if (inputType == "number") {
                inputElement.max = 999999;
            }
            if (inputType == "text") {
                inputElement.maxLength = 128;
            }
            inputElement.value = inputValue;
        }
        inputElements.push([inputLabel, inputElement]);
    }

    const acceptButton = document.createElement("button");
    acceptButton.textContent = acceptText;

    const cancelButton = document.createElement("button");
    cancelButton.appendChild(document.createTextNode("Cancel"));

    const dialog = new Dialog({
        title,
        elements: [
            [inputElements],
            [acceptButton, cancelButton]
        ]
    });

    for (const abortController of abortControllers) {
        dialog.abortControllers.push(abortController);
    }

    const future = new Future<{ [label: string]: any }>();

    acceptButton.addEventListener("click", () => {
        const results: { [label: string]: any } = {};
        for (const [label, inputElement] of inputElements) {
            let value;
            if (inputElement.classList.contains("fragment")) {
                continue;
            }
            if (inputElement.type == "number") {
                value = parseFloat(inputElement.value);
            }
            else if (inputElement.type == "checkbox") {
                value = inputElement.checked;
            }
            else {
                value = inputElement.value;
            }
            results[label.textContent] = value;
        }
        future.resolve(results);
        dialog.close();
    });
    cancelButton.addEventListener("click", () => {
        dialog.close();
    });
    dialog.on_close.push(() => {
        future.resolve(null);
    });

    return await future;
}


export async function ConfirmDialog(prompt: string): Promise<boolean> {
    const confirmButton = Button("check");
    confirmButton.appendChild(document.createTextNode("Confirm"));
    const cancelButton = Button("ban");
    cancelButton.appendChild(document.createTextNode("Cancel"));

    const future = new Future<boolean>();
    const dialog = new Dialog({
        title: "Confirm",
        description: prompt,
        elements: [
            [confirmButton, cancelButton],
        ],
    });

    dialog.on_close.push(() => {
        future.resolve(false);
    });
    confirmButton.addEventListener("click", () => {
        future.resolve(true);
        dialog.close();
    });
    cancelButton.addEventListener("click", () => {
        dialog.close();
    });

    return await future;
}

export async function ImageSelectDialog(prompt: string): Promise<string> {
    const confirmButton = Button("check");
    confirmButton.appendChild(document.createTextNode("Confirm"));
    const cancelButton = Button("ban");
    cancelButton.appendChild(document.createTextNode("Cancel"));

    const filePicker = document.createElement("input");
    filePicker.type = "file";

    const dialog = new Dialog({
        title: "Confirm",
        description: prompt,
        elements: [
            filePicker,
            [confirmButton, cancelButton],
        ],
    });

    const future = new Future<string>();

    dialog.on_close.push(() => {
        future.resolve(null);
    });
    confirmButton.addEventListener("click", () => {
        future.resolve(filePicker.files[0].name);
        dialog.close();
    });
    cancelButton.addEventListener("click", () => {
        dialog.close();
    });

    return await future;
}


export async function launchWindow(type: string, data: any, popOut: boolean = false): Promise<BaseWindow> {
    const windowType = WindowTypes[type];
    const newWindow = new windowType({ popOut });
    await newWindow.deserialize(data);
    return newWindow;
}


export async function applyLayout(layout: SerializedWindow[]) {
    const promises: Promise<void>[] = [];
    for (const windowMap of layout) {
        const position = new Vector2(
            windowMap.left * window.innerWidth,
            windowMap.top * window.innerHeight,
        )
        const windowType = WindowTypes[windowMap.type];
        const newWindow = new windowType({
            size: new Vector2(
                window.innerWidth - position.x - (windowMap.right * window.innerWidth),
                window.innerHeight - position.y - (windowMap.bottom * window.innerHeight),
            ),
            position,
        });
        promises.push(newWindow.deserialize(windowMap.data));
    }
    await Promise.all(promises);
}
