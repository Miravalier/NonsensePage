import { Button } from "./button.js";
import { Vector2 } from "./vector.js";
import { Canvas } from "./canvas.js";
import {
    PageCenter,
    Parameter,
    Bound
} from "./utils.js";


let nextZIndex = 0;


export class BaseWindow {
    constructor(options) {
        options = Parameter(options, {});
        const title = Parameter(options.title, "New Window");
        const size = Parameter(options.size, new Vector2(600, 400));
        const position = Parameter(options.position, PageCenter().subtract(size).divide(2));
        const backgroundColor = Parameter(options.backgroundColor, "#FFFFFF");

        this.minimized = false;
        this.fullscreen = false;

        this.container = document.createElement("div");
        this.container.className = "window";
        this.container.style.left = position.x;
        this.container.style.top = position.y;
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
        titleBar.className = "titleBar";

        titleBar.addEventListener("mousedown", ev => {
            const xOffset = ev.clientX - this.container.offsetLeft;
            const yOffset = ev.clientY - this.container.offsetTop;
            const xMax = window.innerWidth - (Math.ceil(this.container.offsetWidth) + 1);
            const yMax = window.innerHeight - (Math.ceil(this.container.offsetHeight) + 1);

            const onDrag = ev => {
                this.container.style.left = Bound(0, ev.clientX - xOffset, xMax);
                this.container.style.top = Bound(0, ev.clientY - yOffset, yMax);
            }

            const onDragEnd = ev => {
                document.removeEventListener("mousemove", onDrag);
            }

            document.addEventListener("mousemove", onDrag);
            document.addEventListener("mouseup", onDragEnd, { once: true });
        });

        const leftGroup = titleBar.appendChild(document.createElement("div"));
        leftGroup.className = "group";

        leftGroup.appendChild(document.createTextNode(title));

        const rightGroup = titleBar.appendChild(document.createElement("div"));
        rightGroup.className = "group";

        this.minimizeButton = rightGroup.appendChild(Button("fa-window-minimize"));
        this.minimizeButton.addEventListener("click", () => {
            this.toggleMinimize();
        })

        this.fullscreenButton = rightGroup.appendChild(Button("fa-expand-alt"));
        this.fullscreenButton.addEventListener("click", () => {
            this.toggleFullscreen();
        });

        this.closeButton = rightGroup.appendChild(Button("fa-window-close"));
        this.closeButton.addEventListener("click", () => {
            this.close();
        });

        this.viewPort = this.container.appendChild(document.createElement("div"));
        this.viewPort.className = "viewPort";
        this.viewPort.style.width = size.x;
        this.viewPort.style.height = size.y;

        const resizeHandle = this.container.appendChild(document.createElement("div"));
        resizeHandle.className = "resizeHandle";

        resizeHandle.addEventListener("mousedown", ev => {
            const xMax = window.innerWidth - (this.container.offsetLeft + this.viewPort.offsetLeft + 1);
            const yMax = window.innerHeight - (this.container.offsetTop + this.viewPort.offsetTop + 1);

            const onDrag = ev => {
                const xOffset = ev.clientX - this.container.offsetLeft;
                const yOffset = ev.clientY - this.container.offsetTop;
                const width = Bound(0, xOffset, xMax);
                const height = Bound(0, yOffset, yMax);
                this.viewPort.style.width = width;
                this.viewPort.style.height = height;
                if (this.canvas) {
                    this.canvas.view.style.display = "none";
                }
            }

            const onDragEnd = ev => {
                document.removeEventListener("mousemove", onDrag);
                if (this.canvas) {
                    this.canvas.view.width = this.viewPort.offsetWidth;
                    this.canvas.view.height = this.viewPort.offsetHeight;
                    this.canvas.view.style.display = null;
                }
            }

            document.addEventListener("mousemove", onDrag);
            document.addEventListener("mouseup", onDragEnd, { once: true });
        });

        const windows = document.querySelector("#windows");
        windows.appendChild(this.container);
    }

    toggleFullscreen() {
        if (this.minimized) {
            this.toggleMinimize();
        }
        // Undo fullscreen
        if (this.fullscreen) {
            this.fullscreenButton.innerHTML = `<i class="fas fa-expand-alt"></i>`;
            this.container.style.position = null;
            this.container.style.width = null;
            this.container.style.height = null;
            this.viewPort.style.width = this.storedWidth;
            this.viewPort.style.height = this.storedHeight;
            if (this.canvas) {
                this.canvas.view.width = this.viewPort.offsetWidth;
                this.canvas.view.height = this.viewPort.offsetHeight;
            }
        }
        // Become fullscreen
        else {
            this.storedWidth = this.viewPort.offsetWidth;
            this.storedHeight = this.viewPort.offsetHeight;
            this.fullscreenButton.innerHTML = `<i class="fas fa-compress-alt"></i>`;
            this.container.style.position = "unset";
            this.container.style.width = "100%";
            this.container.style.height = "100%";
            this.viewPort.style.width = "100%";
            this.viewPort.style.height = "100%";
            if (this.canvas) {
                this.canvas.view.width = this.viewPort.offsetWidth;
                this.canvas.view.height = this.viewPort.offsetHeight;
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
            this.minimizeButton.innerHTML = `<i class="fas fa-window-minimize"></i>`;
        }
        // Become minimized
        else {
            this.viewPort.style.display = "none";
            this.minimizeButton.innerHTML = `<i class="fas fa-window-maximize"></i>`;
        }
        this.minimized = !this.minimized;
    }

    close() {
        this.container.remove();
    }
}


export class CanvasWindow extends BaseWindow {
    constructor(options) {
        super(options);
        this.viewPort.className = "canvasViewPort";
        this.canvas = new Canvas(this.viewPort);
    }
}


export class ContentWindow extends BaseWindow {
    constructor(options) {
        super(options);
        this.content = this.viewPort.appendChild(document.createElement("div"));
        this.content.className = "content";
    }
}
