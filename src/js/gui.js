import { Parameter } from "./utils.js";


export class Vector2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    static from(obj) {
        if (Array.isArray(obj)) {
            return new Vector2(obj[0], obj[1]);
        }
        else {
            return new Vector2(obj.x, obj.y);
        }
    }

    copy() {
        return new Vector2(this.x, this.y);
    }

    add(point) {
        return new Vector2(this.x + point.x, this.y + point.y);
    }

    applyAdd(point) {
        this.x += point.x;
        this.y += point.y;
    }

    subtract(point) {
        return new Vector2(this.x - point.x, this.y - point.y);
    }

    applySubtract(point) {
        this.x -= point.x;
        this.y -= point.y;
    }

    multiply(value) {
        return new Vector2(this.x * value, this.y * value);
    }

    applyMultiply(value) {
        this.x *= value;
        this.y *= value;
    }

    divide(value) {
        return new Vector2(this.x / value, this.y / value);
    }

    applyDivide(value) {
        this.x /= value;
        this.y /= value;
    }
}


const APP_BACKGROUND_COLOR = 0x222222;
const WINDOW_COLOR = 0xFFFFFF;
const DEFAULT_WINDOW_DIMENSIONS = new Vector2(600, 600);
const DEFAULT_WINDOW_BORDER_STYLE = { width: 2, color: WINDOW_COLOR, alpha: 0.25 };
const DEFAULT_WINDOW_STYLE = { color: WINDOW_COLOR, alpha: 0.2, cornerRadius: 4 };


export class GUI {
    constructor() {
        const canvas_width = Math.max($(window).width(), 800);
        const canvas_height = Math.max($(window).height(), 800);
        console.log("Canvas Size", { width: canvas_width, height: canvas_height });

        this.app = new PIXI.Application({
            width: canvas_width,
            height: canvas_height,
            backgroundColor: APP_BACKGROUND_COLOR
        });
        document.body.appendChild(this.app.view);

        this.stage = this.app.stage;
        this.height = canvas_height;
        this.width = canvas_width;
        this.dimensions = new Vector2(canvas_width, canvas_height);
        this.center = this.dimensions.divide(2);
    }

    CreateWindow(options) {
        // Get options
        options = Parameter(options, {});
        const dimensions = options.dimensions || DEFAULT_WINDOW_DIMENSIONS;
        const location = options.location || this.center.subtract(dimensions.divide(2));
        const borderStyle = options.borderStyle || DEFAULT_WINDOW_BORDER_STYLE;
        const windowStyle = options.windowStyle || DEFAULT_WINDOW_STYLE;
        const draggable = Parameter(options.draggable, true);
        const resizable = Parameter(options.resizable, true);

        // Create PIXI objects
        const container = new PIXI.Container();
        container.x = location.x;
        container.y = location.y;

        const window = new PIXI.Graphics();
        window.lineStyle(borderStyle);
        window.beginFill(windowStyle.color, windowStyle.alpha || 1);
        window.drawRoundedRect(0, 0, dimensions.x, dimensions.y, windowStyle.cornerRadius || 0);
        container.addChild(window);

        if (resizable) {
            // TODO
        }

        if (draggable) {
            // TODO
        }

        this.stage.addChild(container);
        return container;
    }
}
