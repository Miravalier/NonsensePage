import * as PIXI from "pixi.js";

import * as ContextMenu from "./contextmenu.ts";
import { Parameter, Require, IsDefined } from "./utils.ts";
import { Vector2 } from "./vector.ts";
import { Layer } from "./enums.ts";
import { ApiRequest } from "./requests.ts";
import { GridFilter } from "../filters/grid.ts";


export const NO_GRID = 0
export const WHITE_GRID = 1
export const BLACK_GRID = 2


export class CanvasContainer {
    node: PIXI.Container;

    constructor(node: PIXI.Container) {
        this.node = node;
    }

    AddGrid(options) {
        // Get options
        Require(options);
        const width = Require(options.width);
        const height = Require(options.height);
        const squareSize = Require(options.squareSize);
        const translation = Parameter(options.translation, new Vector2(0, 0));
        const scale = Parameter(options.scale, 1);
        let color: number[];
        if (options.color == WHITE_GRID) {
            color = [0.1, 0.1, 0.1, 0.2];
        }
        else if (options.color == BLACK_GRID) {
            color = [0.0, 0.0, 0.0, 0.25];
        }
        else {
            color = [0.0, 0.0, 0.0, 0.0];
        }

        const gridFilter = new GridFilter(width, height, squareSize, translation, scale, new PIXI.Color(color));
        const maskContainer = new PIXI.Container();
        const maskBackground = new PIXI.Graphics();
        maskBackground.rect(0, 0, width, height);
        maskBackground.fill({ color: new PIXI.Color(0xFFFFFF), alpha: 1.0 });
        maskContainer.addChild(maskBackground);
        maskContainer.filters = [gridFilter];

        this.node.addChild(maskContainer);
        return maskContainer;
    }

    AddContainer(position: Vector2 = new Vector2(0, 0), scale: number = 1) {
        const container = new PIXI.Container();
        container.x = position.x;
        container.y = position.y;
        container.scale.x = scale;
        container.scale.y = scale;
        this.node.addChild(container);
        return new CanvasContainer(container);
    }

    async DrawSprite(options) {
        Require(options);
        const src = Require(options.src);
        const width = Parameter(options.width, 256);
        const height = Parameter(options.height, 256);
        const scale = Parameter(options.scale, new Vector2(1, 1));
        const position = Parameter(options.position, new Vector2(0, 0));

        let texture;
        try {
            texture = await PIXI.Assets.load(src);
        } catch (error) {
            console.error(`Failed to load texture: ${src}`);
            texture = await PIXI.Assets.load("/unknown.png");
        }
        const sprite = new PIXI.Sprite(texture);
        sprite.width = width;
        sprite.height = height
        sprite.scale.x = scale.x;
        sprite.scale.y = scale.y;
        sprite.x = position.x;
        sprite.y = position.y;
        this.node.addChild(sprite);
        return sprite;
    }

    DrawRectangle(options) {
        // Get options
        Require(options);
        const size = Require(options.size);
        const position = Parameter(options.position, new Vector2(0, 0));
        const fillColor = Parameter(options.fillColor, 0xFFFFFF);
        const fillAlpha = Parameter(options.fillAlpha, 1);
        const cornerRadius = Parameter(options.cornerRadius, null);
        const borderColor = Parameter(options.borderColor, 0xFFFFFF);
        const borderAlpha = Parameter(options.borderAlpha, 1);
        const borderWidth = Parameter(options.borderWidth, 1);

        // Create PIXI object
        const rect = new PIXI.Graphics();

        if (cornerRadius === null) {
            rect.rect(position.x, position.y, size.x, size.y);
        }
        else {
            rect.roundRect(position.x, position.y, size.x, size.y, cornerRadius);
        }
        rect.fill({ color: fillColor, alpha: fillAlpha });
        if (IsDefined(options.borderColor)) {
            rect.stroke({ width: borderWidth, color: borderColor, alpha: borderAlpha });
        }

        // Display the object and return
        this.node.addChild(rect);
        return rect;
    }

    DrawCircle(options) {
        // Get options
        Require(options);
        const radius = Require(options.radius);
        const position = Parameter(options.position, new Vector2(0, 0));
        const fillColor = Parameter(options.fillColor, null);
        const fillAlpha = Parameter(options.fillAlpha, 1);
        const borderColor = Parameter(options.borderColor, null);
        const borderAlpha = Parameter(options.borderAlpha, 1);
        const borderWidth = Parameter(options.borderWidth, 1);

        // Create PIXI object
        const circle = new PIXI.Graphics();
        circle.circle(position.x, position.y, radius);
        if (IsDefined(options.borderColor)) {
            circle.stroke({ color: borderColor, alpha: borderAlpha, width: borderWidth });
        }
        if (IsDefined(options.fillColor)) {
            circle.fill({ color: fillColor, alpha: fillAlpha });
        }

        // Display the object and return
        this.node.addChild(circle);
        return circle;
    }
}


export class Canvas {
    htmlContainer: HTMLDivElement;
    app: PIXI.Application;
    stage: PIXI.Container;
    renderer: PIXI.Renderer;
    view: HTMLCanvasElement;

    constructor() {
        this.app = new PIXI.Application();
    }

    async init(options) {
        const htmlContainer = Parameter(options.container, document.body);
        const backgroundColor = Parameter(options.backgroundColor, 0x2d2d2d);
        await this.app.init({
            preference: 'webgl',
            backgroundAlpha: 1,
            resizeTo: htmlContainer,
            backgroundColor,
        });

        /* Uncomment the next line to enable PixiJS debugging */
        // globalThis.__PIXI_APP__ = app;

        this.htmlContainer = htmlContainer;
        this.stage = this.app.stage;
        this.renderer = this.app.renderer;
        this.view = this.app.canvas;
        this.htmlContainer.appendChild(this.app.canvas);
    }

    rootContainer() {
        return new CanvasContainer(this.app.stage)
    }

    onResize(x: number, y: number) {
        this.renderer.resize(x, y);
    }
}


export class MapCanvas extends Canvas {
    id: string;
    tokenNodes: { [id: string]: any };
    grid: PIXI.Container;
    tokenContainer: CanvasContainer;
    backgroundContainer: CanvasContainer;
    detailContainer: CanvasContainer;
    characterContainer: CanvasContainer;
    effectContainer: CanvasContainer;

    constructor() {
        super();
        this.id = null;
        this.tokenNodes = {};
    }

    onResize(x: number, y: number) {
        super.onResize(x, y);
        this.grid.width = x;
        this.grid.height = y;
        const gridFilter = this.grid.filters[0] as GridFilter;
        gridFilter.uniforms.uViewport = new PIXI.Point(x, y);
    }

    /**
     * @param {Vector2} position
     * @returns {Vector2}
     */
    ScreenToOuterCoords(position) {
        return new Vector2(
            position.x - (this.htmlContainer.parentElement.offsetLeft + this.htmlContainer.offsetLeft),
            position.y - (this.htmlContainer.parentElement.offsetTop + this.htmlContainer.offsetTop)
        );
    }

    /**
     * @param {Vector2} position
     * @returns {Vector2}
     */
    ScreenToWorldCoords(position) {
        const node = this.tokenContainer.node;
        return new Vector2(
            (position.x - (this.htmlContainer.parentElement.offsetLeft + this.htmlContainer.offsetLeft) - node.x) / node.scale.x,
            (position.y - (this.htmlContainer.parentElement.offsetTop + this.htmlContainer.offsetTop) - node.y) / node.scale.y
        );
    }

    async AddToken(token) {
        let container: CanvasContainer;
        if (token.layer == Layer.BACKGROUND) {
            container = this.backgroundContainer;
        }
        else if (token.layer == Layer.DETAILS) {
            container = this.detailContainer;
        }
        else if (token.layer == Layer.CHARACTERS) {
            container = this.characterContainer;
        }
        else if (token.layer == Layer.EFFECTS) {
            container = this.effectContainer;
        }
        const sprite = await container.DrawSprite({
            src: token.src,
            width: token.width,
            height: token.height,
            position: new Vector2(token.x, token.y),
        });
        sprite.interactive = true;

        this.tokenNodes[token.id] = sprite;

        sprite.on("mousedown", ev => {
            let spriteMoved = false;
            const dragOffset = this.ScreenToWorldCoords(new Vector2(ev.clientX, ev.clientY));
            dragOffset.applySubtract(new Vector2(sprite.position.x, sprite.position.y));

            const onDrag = ev => {
                spriteMoved = true;
                const worldCoords = this.ScreenToWorldCoords(new Vector2(ev.clientX, ev.clientY));
                worldCoords.applySubtract(dragOffset);
                sprite.x = worldCoords.x;
                sprite.y = worldCoords.y;
            }

            const onDragEnd = async () => {
                document.removeEventListener("mousemove", onDrag);
                if (spriteMoved) {
                    await ApiRequest("/map/update", {
                        id: this.id,
                        changes: {
                            "$set": {
                                [`tokens.${token.id}.x`]: sprite.x,
                                [`tokens.${token.id}.y`]: sprite.y,
                            },
                        },
                    });
                }
            }

            document.addEventListener("mousemove", onDrag);
            document.addEventListener("mouseup", onDragEnd, { once: true });
        });

        ContextMenu.set(sprite as any, {
            "Edit Token": {
                "Delete Token": async () => {
                    await ApiRequest("/map/update", {
                        id: this.id,
                        changes: {
                            "$unset": {
                                [`tokens.${token.id}`]: null,
                            },
                        },
                    });
                }
            }
        });
    }

    DeleteToken(id) {
        this.tokenNodes[id].destroy();
        delete this.tokenNodes[id];
    }

    async render(map, translation, scale) {
        this.id = map.id;

        if (this.tokenContainer) {
            this.tokenContainer.node.destroy();
        }
        if (this.grid) {
            this.grid.destroy();
        }

        const root = this.rootContainer();
        this.tokenContainer = root.AddContainer(translation, scale);
        this.backgroundContainer = this.tokenContainer.AddContainer();
        this.detailContainer = this.tokenContainer.AddContainer();
        this.characterContainer = this.tokenContainer.AddContainer();
        this.effectContainer = this.tokenContainer.AddContainer();
        this.grid = root.AddGrid({
            width: this.htmlContainer.offsetWidth,
            height: this.htmlContainer.offsetHeight,
            squareSize: map.squareSize,
            translation: translation,
            scale: scale,
            color: map.color,
        });

        for (const token of Object.values(map.tokens)) {
            await this.AddToken(token);
        }
    }
}
