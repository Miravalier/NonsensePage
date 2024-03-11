import * as ContextMenu from "./contextmenu.js";
import { Parameter, Require, IsDefined } from "./utils.js";
import { Vector2 } from "./vector.js";
import { Layer } from "./enums.js";
import { ApiRequest } from "./requests.js";

declare const PIXI: any;

const NO_GRID = 0
const WHITE_GRID = 1
const BLACK_GRID = 2


export class CanvasContainer {
    node: any;
    grid: any;

    constructor(node) {
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
        let color;
        if (options.color == WHITE_GRID) {
            color = [0.1, 0.1, 0.1, 0.2];
        }
        else if (options.color == BLACK_GRID) {
            color = [0.0, 0.0, 0.0, 0.25];
        }
        else {
            color = [0.0, 0.0, 0.0, 0.0];
        }

        const fragmentShader = `
            precision mediump float;

            uniform vec2 viewport;      // e.g. [800 600] Size of the canvas
            uniform vec2 pitch;         // e.g. [512 512] Size of the grid squares
            uniform vec2 translation;   // e.g. [0 0] Shifts the grid by x, y pixels
            uniform vec2 scale;         // e.g. [1.0 1.0] 0.0 - 1.0, Scale percentage in x and y
            uniform vec4 color;         // e.g. [0.1, 0.1, 0.1, 0.2] Color of the  grid

            void main() {
                float offX = (gl_FragCoord.x - translation.x);
                float offY = (1.0 - (viewport.y - (gl_FragCoord.y + translation.y)));

                if (int(mod(offX, pitch[0] * scale[0])) == 0 ||
                    int(mod(offY, pitch[1] * scale[1])) == 0) {
                    gl_FragColor = color;
                } else {
                    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
                }
            }
        `;

        const uniforms = {
            viewport: [width, height],
            pitch: [squareSize, squareSize],
            translation: [translation.x, translation.y],
            scale: [scale, scale],
            color: [0.1, 0.1, 0.1, 0.2],
        };

        const gridFilter = new PIXI.Filter(undefined, fragmentShader, uniforms);
        const maskContainer = new PIXI.Container();
        const maskBackground = new PIXI.Graphics();
        maskBackground.beginFill(0xFFFFFF, 1);
        maskBackground.drawRect(0, 0, width, height);
        maskContainer.addChild(maskBackground);
        maskContainer.filters = [gridFilter];

        this.node.addChild(maskContainer);
        return maskContainer;
    }

    AddContainer(position, scale) {
        position = Parameter(position, new Vector2(0, 0));
        scale = Parameter(scale, 1);
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
            texture = await PIXI.Texture.fromURL(src);
        } catch (error) {
            console.error(`Failed to load texture: ${src}`);
            texture = await PIXI.Texture.fromURL("/unknown.png");
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
        if (IsDefined(options.borderColor)) {
            circle.lineStyle({ color: borderColor, alpha: borderAlpha, width: borderWidth });
        }
        if (IsDefined(options.fillColor)) {
            circle.beginFill(fillColor, fillAlpha);
        }

        circle.drawCircle(position.x, position.y, radius);

        // Display the object and return
        this.node.addChild(circle);
        return circle;
    }
}


export class Canvas extends CanvasContainer {
    htmlContainer: HTMLDivElement;
    app: any;
    view: any;
    stage: any;
    renderer: any;

    constructor(options) {
        const htmlContainer = Parameter(options.container, document.body);
        const backgroundColor = Parameter(options.backgroundColor, 0x2d2d2d);
        const app = new PIXI.Application({
            transparent: true,
            resizeTo: htmlContainer,
            backgroundColor,
        });
        super(app.stage);

        /* Uncomment the next line to enable PixiJS debugging */
        // globalThis.__PIXI_APP__ = app;

        this.htmlContainer = htmlContainer;
        this.app = app;
        this.view = app.view;
        this.stage = app.stage;
        this.renderer = app.renderer;
        this.htmlContainer.appendChild(this.app.view);
    }

    onResize(x, y) {
        this.renderer.resize(x, y);
    }
}


export class MapCanvas extends Canvas {
    id: string;
    tokenNodes: { [id: string]: any };
    tokenContainer: any;
    backgroundContainer: any;
    detailContainer: any;
    characterContainer: any;
    effectContainer: any;

    constructor(options) {
        super(options);
        this.id = null;
        this.tokenNodes = {};
    }

    onResize(x, y) {
        super.onResize(x, y);
        this.grid.width = x;
        this.grid.height = y;
        const gridFilter = this.grid.filters[0];
        gridFilter.uniforms.viewport = [x, y];
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
        let container;
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
        sprite.buttonMode = true;

        this.tokenNodes[token.id] = sprite;

        sprite.on("mousedown", ev => {
            let spriteMoved = false;
            const dragOffset = this.ScreenToWorldCoords(new Vector2(ev.clientX, ev.clientY));
            dragOffset.applySubtract(sprite.position);

            const onDrag = ev => {
                spriteMoved = true;
                const worldCoords = this.ScreenToWorldCoords(new Vector2(ev.clientX, ev.clientY));
                worldCoords.applySubtract(dragOffset);
                sprite.x = worldCoords.x;
                sprite.y = worldCoords.y;
            }

            const onDragEnd = async ev => {
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

        ContextMenu.set(sprite, {
            "Edit Token": {
                "Delete Token": async (ev) => {
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

        this.tokenContainer = this.AddContainer(translation, scale);
        this.backgroundContainer = this.tokenContainer.AddContainer();
        this.detailContainer = this.tokenContainer.AddContainer();
        this.characterContainer = this.tokenContainer.AddContainer();
        this.effectContainer = this.tokenContainer.AddContainer();
        this.grid = this.AddGrid({
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
