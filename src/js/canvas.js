import { Parameter, Require, IsDefined } from "./utils.js";


export class Canvas {
    constructor(htmlContainer) {
        this.htmlContainer = Parameter(htmlContainer, document.body);

        this.app = new PIXI.Application({
            transparent: true,
            resizeTo: this.htmlContainer,
        });

        this.stage = this.app.stage;
        this.view = this.app.view;
        this.htmlContainer.appendChild(this.view);
    }

    async DrawSprite(resource) {
        const texture = await PIXI.Texture.fromURL(resource);
        const sprite = new PIXI.Sprite(texture);
        this.stage.addChild(sprite);
        return sprite;
    }

    DrawRectangle(options) {
        // Get options
        Require(options);
        const size = Require(options.size);
        const position = Require(options.position);
        const fillColor = Parameter(options.fillColor, 0xFFFFFF);
        const fillAlpha = Parameter(options.fillAlpha, 1);
        const cornerRadius = Parameter(options.cornerRadius, null);
        const borderColor = Parameter(options.borderColor, 0xFFFFFF);
        const borderAlpha = Parameter(options.borderAlpha, 1);
        const borderWidth = Parameter(options.borderWidth, 1);

        // Create PIXI object
        const rect = new PIXI.Graphics();
        if (IsDefined(options.borderColor)) {
            rect.lineStyle({ color: borderColor, alpha: borderAlpha, width: borderWidth });
        }
        if (IsDefined(options.fillColor)) {
            rect.beginFill(fillColor, fillAlpha);
        }

        if (cornerRadius === null) {
            rect.drawRect(position.x, position.y, size.x, size.y);
        }
        else {
            rect.drawRoundedRect(position.x, position.y, size.x, size.y, cornerRadius);
        }

        // Display the object and return
        this.stage.addChild(rect);
        return rect;
    }

    DrawCircle(options) {
        // Get options
        Require(options);
        const radius = Require(options.radius);
        const position = Require(options.position);
        const fillColor = Parameter(options.fillColor, null);
        const fillAlpha = Parameter(options.fillAlpha, 1);
        const borderColor = Parameter(options.borderColor, null);
        const borderAlpha = Parameter(options.borderAlpha, 1);
        const borderWidth = Parameter(options.borderWidth, 1);

        // Create PIXI object
        const circle = new PIXI.Graphics();
        if (IsDefined(options.borderColor)) {
            circle.lineStyle({ color: borderColor, alpha: borderAlpha, width: borderWidth });
        }
        if (IsDefined(options.fillColor)) {
            circle.beginFill(fillColor, fillAlpha);
        }

        circle.drawCircle(position.x, position.y, radius);

        // Display the object and return
        this.stage.addChild(circle);
        return circle;
    }
}
