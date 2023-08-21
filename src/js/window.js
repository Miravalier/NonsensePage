import { Button } from "./elements.js";
import { Vector2 } from "./vector.js";
import { Canvas } from "./canvas.js";
import { Subscribe } from "./requests.js";
import {
    PageCenter,
    Parameter,
    Bound,
    StringBound,
    AddDropListener,
} from "./utils.js";


let nextZIndex = 0;


export class BaseWindow {
    constructor(options) {
        options = Parameter(options, {});
        const title = Parameter(options.title, "");
        const size = Parameter(options.size, new Vector2(600, 400));
        const position = Parameter(options.position, PageCenter().subtract(size).divide(2));
        const backgroundColor = Parameter(options.backgroundColor, "#324051");
        const classList = Parameter(options.classList, []);
        classList.push("window");
        const resizable = Parameter(options.resizable, true);
        const refreshable = Parameter(options.refreshable, false);

        this.on_close = [];
        this.subscriptions = [];
        this.abortControllers = [];

        this.minimized = false;
        this.fullscreen = false;

        this.container = document.createElement("div");
        this.container.classList = classList.join(" ");
        this.container.style.left = `${position.x}px`;
        this.container.style.top = `${position.y}px`;
        this.container.style.zIndex = ++nextZIndex;
        if (this.backgroundColor !== null) {
            this.container.style.backgroundColor = backgroundColor;
        }

        this.container.addEventListener("mousedown", () => {
            if (this.container.style.zIndex != nextZIndex) {
                this.container.style.zIndex = ++nextZIndex;
            }
        });

        const titleBar = this.container.appendChild(document.createElement("div"));
        this.titleBar = titleBar;
        titleBar.className = "titleBar";

        titleBar.addEventListener("mousedown", ev => {
            const xOffset = ev.clientX - this.container.offsetLeft;
            const yOffset = ev.clientY - this.container.offsetTop;
            const xMax = window.innerWidth - (Math.ceil(this.container.offsetWidth) + 1);
            const yMax = window.innerHeight - (Math.ceil(this.container.offsetHeight) + 1);

            const onDrag = ev => {
                this.container.style.left = `${Bound(0, ev.clientX - xOffset, xMax)}px`;
                this.container.style.top = `${Bound(0, ev.clientY - yOffset, yMax)}px`;
            }

            const onDragEnd = ev => {
                document.removeEventListener("mousemove", onDrag);
            }

            document.addEventListener("mousemove", onDrag);
            document.addEventListener("mouseup", onDragEnd, { once: true });
        });

        if (resizable) {
            titleBar.addEventListener("dblclick", ev => {
                this.toggleMinimize();
            });
        }

        const leftGroup = titleBar.appendChild(document.createElement("div"));
        leftGroup.className = "group";
        leftGroup.appendChild(document.createTextNode(" "));
        this.titleNode = leftGroup.firstChild;
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

        this.viewPort = this.container.appendChild(document.createElement("div"));
        this.viewPort.className = "viewPort";
        if (resizable) {
            this.viewPort.style.width = `${size.x}px`;
            this.viewPort.style.height = `${size.y}px`;
        }

        if (resizable) {
            const resizeHandle = this.container.appendChild(document.createElement("div"));
            this.resizeHandle = resizeHandle;
            resizeHandle.className = "resizeHandle";

            resizeHandle.addEventListener("mousedown", ev => {
                const xMax = window.innerWidth - (this.container.offsetLeft + this.viewPort.offsetLeft + 1);
                const yMax = window.innerHeight - (this.container.offsetTop + this.viewPort.offsetTop + 1);

                const onDrag = ev => {
                    const xOffset = ev.clientX - this.container.offsetLeft;
                    const yOffset = ev.clientY - this.container.offsetTop;
                    let minWidth = 10;
                    for (const group of this.titleBar.children) {
                        minWidth += group.clientWidth;
                    }
                    const width = Bound(minWidth, xOffset, xMax);
                    const height = Bound(40, yOffset, yMax);
                    this.viewPort.style.width = `${width}px`;
                    this.viewPort.style.height = `${height}px`;
                    if (this.canvas) {
                        this.canvas.view.style.display = "none";
                    }
                }

                const onDragEnd = ev => {
                    document.removeEventListener("mousemove", onDrag);
                    if (this.canvas) {
                        this.canvas.view.style.display = null;
                        this.canvas.view.width = this.viewPort.offsetWidth;
                        this.canvas.view.height = this.viewPort.offsetHeight;
                        this.canvas.renderer.resize(this.viewPort.offsetWidth, this.viewPort.offsetHeight);
                    }
                }

                document.addEventListener("mousemove", onDrag);
                document.addEventListener("mouseup", onDragEnd, { once: true });
            });
        }

        const windows = document.querySelector("#windows");
        windows.appendChild(this.container);
    }

    setTitle(s) {
        this.titleNode.textContent = StringBound(s, 40);
    }

    addDropListener(element, fn) {
        this.abortControllers.push(AddDropListener(element, fn));
    }

    async subscribe(id, callback) {
        const subscription = await Subscribe(id, callback);
        this.subscriptions.push(subscription);
        return subscription;
    }

    async load() {
        for (let subscription of this.subscriptions) {
            subscription.cancel();
        }
        for (let controller of this.abortControllers) {
            controller.abort();
        }
        this.subscriptions = [];
        this.abortControllers = [];
    }

    refresh() {
        this.load();
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
            if (this.canvas) {
                this.canvas.view.width = this.viewPort.offsetWidth;
                this.canvas.view.height = this.viewPort.offsetHeight;
            }
            this.resizeHandle.style.display = null;
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
            if (this.canvas) {
                this.canvas.view.width = this.viewPort.offsetWidth;
                this.canvas.view.height = this.viewPort.offsetHeight;
            }
            this.resizeHandle.style.display = "none";
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
            this.resizeHandle.style.display = null;
        }
        // Become minimized
        else {
            this.viewPort.style.display = "none";
            this.minimizeButton.innerHTML = `<i class="fa-solid fa-window-maximize button"></i>`;
            this.resizeHandle.style.display = "none";
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
    }
}


export class CanvasWindow extends BaseWindow {
    constructor(options) {
        super(options);
        const canvasClass = Parameter(options.canvasClass, Canvas);
        this.viewPort.className = "canvasViewPort";
        options.container = this.viewPort;
        this.canvas = new canvasClass(options);
    }
}


export class ContentWindow extends BaseWindow {
    constructor(options) {
        super(options);
        this.content = this.viewPort.appendChild(document.createElement("div"));
        this.content.className = "content";
    }
}


/**
 * @param {HTMLDivElement} container
 * @param {(HTMLElement|HTMLElement[])} element
 */
function AddElement(container, element) {
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
        container.appendChild(subcontainer);
    }
    else {
        container.appendChild(element);
    }
}


export class Dialog extends ContentWindow {
    constructor(options) {
        // Default resizable to false instead of true
        options.resizable = Parameter(options.resizable, false);
        options.title = Parameter(options.title, "New Dialog");
        super(options);
        this.content.classList.add("dialog");

        // Add description
        const description = Parameter(options.description, "");
        this.description = this.content.appendChild(document.createElement("div"));
        this.description.className = "description";
        this.description.appendChild(document.createTextNode(description));

        // Add sub elements
        const elements = Parameter(options.elements, []);
        this.elements = this.content.appendChild(document.createElement("div"));
        this.elements.classList = "elements column";
        for (let element of elements) {
            AddElement(this.elements, element);
        }
    }
}


export function InputDialog(title, inputs, acceptText) {
    const inputElements = [];
    for (const [labelText, inputData] of Object.entries(inputs)) {
        let inputType;
        let startingValue = "";
        if (Array.isArray(inputData)) {
            [inputType, startingValue] = inputData;
        }
        else {
            inputType = inputData;
        }

        const inputLabel = document.createElement("span");
        inputLabel.classList.add("label");
        inputLabel.textContent = labelText;
        let inputElement;
        if (inputType == "paragraph") {
            inputElement = document.createElement("textarea");
            inputElement.maxLength = 10000;
            inputElement.value = startingValue;
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
            inputElement.value = startingValue;
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
            inputElements,
            [acceptButton, cancelButton]
        ]
    });

    return new Promise((resolve) => {
        let results = null;
        acceptButton.addEventListener("click", () => {
            results = {};
            for (const [label, inputElement] of inputElements) {
                let value;
                if (inputElement.type == "number") {
                    value = parseInt(inputElement.value);
                }
                else {
                    value = inputElement.value;
                }
                results[label.textContent] = value;
            }
            dialog.close();
        });
        cancelButton.addEventListener("click", () => {
            dialog.close();
        });
        dialog.on_close.push(() => {
            resolve(results);
        });
    });
}


export function ConfirmDialog(prompt) {
    const confirmButton = Button("check");
    confirmButton.appendChild(document.createTextNode("Confirm"));
    const cancelButton = Button("ban");
    cancelButton.appendChild(document.createTextNode("Cancel"));

    const dialog = new Dialog({
        title: "Confirm",
        description: prompt,
        elements: [
            [confirmButton, cancelButton],
        ],
    });

    return new Promise((resolve) => {
        let result = false;
        confirmButton.addEventListener("click", () => {
            result = true;
            dialog.close();
        });
        cancelButton.addEventListener("click", () => {
            result = false;
            dialog.close();
        });
        dialog.on_close.push(() => {
            resolve(result);
        });
    });
}

export function ImageSelectDialog(prompt) {
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

    return new Promise((resolve) => {
        let result = false;
        confirmButton.addEventListener("click", () => {
            result = filePicker.files[0].name;
            dialog.close();
        });
        cancelButton.addEventListener("click", () => {
            result = false;
            dialog.close();
        });
        dialog.on_close.push(() => {
            resolve(result);
        });
    });
}


export class Wizard extends ContentWindow {
    constructor(options) {
        // Default resizable to false instead of true
        options.resizable = Parameter(options.resizable, false);
        options.title = Parameter(options.title, "New Wizard");
        super(options);
        this.content.classList.add("wizard");

        // Add sub elements
        options.pages = Parameter(options.pages, {});
        for (const { page, elements } of Object.entries(options.pages)) {
            const pageContainer = this.content.appendChild(Html(`

            `));
            const elementContainer = page.appendChild(document.createElement("div"));
            this.elements.classList = "elements column";
            for (let element of elements) {
                AddElement(this.elements, element);
            }
        }
    }
}
