import { PageCenter, Parameter, Require, IsDefined } from "./utils.js";
import { Vector2 } from "./vector.js";
import { Canvas } from "./canvas.js";


export class BaseWindow {
    constructor(options) {
        options = Parameter(options, {});
        const size = Parameter(options.size, new Vector2(600, 400));
        const position = Parameter(options.position, PageCenter().subtract(size).divide(2));
        const backgroundColor = Parameter(options.backgroundColor, null);

        this.element = document.createElement("div");
        this.element.className = "window";
        this.element.style.left = position.x;
        this.element.style.top = position.y;
        this.element.style.width = size.x;
        this.element.style.height = size.y;
        if (this.backgroundColor !== null) {
            this.element.style.backgroundColor = backgroundColor;
        }

        const windows = document.querySelector("#windows");
        windows.appendChild(this.element);
    }
}


export class CanvasWindow extends BaseWindow {
    constructor(options) {
        super(options);
        this.canvas = new Canvas(this.element);
    }
}
