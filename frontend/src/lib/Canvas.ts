import * as PIXI from "pixi.js";

import * as ContextMenu from "./ContextMenu.ts";
import { Parameter, Require, IsDefined } from "./Utils.ts";
import { Vector2 } from "./Vector.ts";
import { Layer } from "./Enums.ts";
import { ApiRequest, Session } from "./Requests.ts";
import { GridFilter } from "../filters/Grid.ts";
import { launchWindow } from "../windows/Window.ts";
import { ScaleType } from "./Models.ts";


export const NO_GRID = 0
export const WHITE_GRID = 1
export const BLACK_GRID = 2


export class CanvasContainer {
    node: PIXI.Container;

    constructor(node: PIXI.Container) {
        this.node = node;
    }

    AddText(options: {
        position?: Vector2,
        content?: string,
        center?: boolean,
        color?: string,
        shadow?: boolean,
    }) {
        const position = Parameter(options.position, new Vector2(0, 0));
        const content = Parameter(options.content, "");
        const center = Parameter(options.center, false);
        const color = Parameter(options.color, "#ffffff");
        const shadow = Parameter(options.shadow, true);
        const label = new PIXI.Text();
        if (center) {
            label.style.align = "center";
            label.anchor.set(0.5, 0);
        }
        label.x = position.x;
        label.y = position.y;
        label.text = content;
        if (shadow) {
            label.style.dropShadow = true;
        }
        label.style.fill = color;
        this.node.addChild(label);
        return label;
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
        const container = new PIXI.Container({ sortableChildren: true });
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
        const width: number = Parameter(options.width, null);
        const height: number = Parameter(options.height, null);
        const scaleType: number = Parameter(options.scaleType, ScaleType.Absolute);
        const rotation: number = Parameter(options.rotation, 0);
        const position = Parameter(options.position, new Vector2(0, 0));
        const z = Parameter(options.z, 0);

        let texture;
        try {
            if (!src) {
                throw Error("no src");
            }
            texture = await PIXI.Assets.load(src);
        } catch (error) {
            console.error(`Failed to load texture: ${src}`);
            texture = await PIXI.Assets.load("/unknown.png");
        }
        const sprite = PIXI.Sprite.from(texture);
        sprite.anchor.set(0.5, 0.5);
        sprite.rotation = rotation;
        if (scaleType == ScaleType.Absolute) {
            sprite.width = width;
            sprite.height = height;
        }
        else {
            sprite.scale.x = width;
            sprite.scale.y = height;
        }

        sprite.x = position.x;
        sprite.y = position.y;
        sprite.zIndex = z;
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
    windowElement: HTMLDivElement;
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
        globalThis.__PIXI_APP__ = this.app;

        this.htmlContainer = htmlContainer;
        this.stage = this.app.stage;
        this.renderer = this.app.renderer;
        this.view = this.app.canvas;
        this.htmlContainer.appendChild(this.app.canvas);
        this.windowElement = htmlContainer.closest(".window");
    }

    get rootContainer() {
        return new CanvasContainer(this.app.stage)
    }

    onResize(x: number, y: number) {
        this.renderer.resize(x, y);
    }
}


export class MapCanvas extends Canvas {
    id: string;
    tokenNodes: { [id: string]: PIXI.Sprite };
    grid: PIXI.Container;
    tokenContainer: CanvasContainer;
    backgroundContainer: CanvasContainer;
    detailContainer: CanvasContainer;
    characterContainer: CanvasContainer;
    effectContainer: CanvasContainer;
    highestZIndex: number;
    squareSize: number;

    constructor() {
        super();
        this.id = null;
        this.tokenNodes = {};
        this.highestZIndex = 0;
        this.squareSize = 1;
    }

    getElementAtScreenPos(x: number, y: number): PIXI.Container {
        const boundary = new PIXI.EventBoundary(this.app.stage);
        const xOffset = this.windowElement.offsetLeft + this.view.offsetLeft;
        const yOffset = this.windowElement.offsetTop + this.view.offsetTop;
        return boundary.hitTest(x - xOffset, y - yOffset);
    }

    async init(options: any) {
        await super.init(options);

        let pingTimeoutHandle: number = null;
        let pingLocation: Vector2 = null;
        const startPingTimer = (x: number, y: number) => {
            if (pingTimeoutHandle !== null) {
                return;
            }
            pingLocation = new Vector2(x, y);
            pingTimeoutHandle = setTimeout(async () => {
                const worldCoords = this.ScreenToWorldCoords(pingLocation);
                await ApiRequest("/map/ping", { id: this.id, x: worldCoords.x, y: worldCoords.y });
            }, 750);
        };

        const stopPingTimer = () => {
            if (pingTimeoutHandle !== null) {
                clearTimeout(pingTimeoutHandle);
                pingTimeoutHandle = null;
            }
        };

        this.view.addEventListener("mousedown", (ev) => {
            // Can't ping with right clicks
            if (ev.button == 2) {
                return;
            }

            if (this.getElementAtScreenPos(ev.clientX, ev.clientY)) {
                return;
            }
            startPingTimer(ev.clientX, ev.clientY);
        });

        this.view.addEventListener("mousemove", (ev) => {
            if (pingTimeoutHandle === null) {
                return;
            }
            const currentLocation = new Vector2(ev.clientX, ev.clientY);
            if (currentLocation.distance(pingLocation) > 10) {
                stopPingTimer();
            }
        });

        this.view.addEventListener("touchstart", (ev) => {
            // Can't ping with multitouch
            if (ev.touches.length > 1) {
                stopPingTimer();
                return;
            }
            startPingTimer(ev.touches[0].clientX, ev.touches[0].clientY);
        });

        this.view.addEventListener("touchmove", (ev) => {
            if (pingTimeoutHandle === null) {
                return;
            }
            const currentLocation = new Vector2(ev.touches[0].clientX, ev.touches[0].clientY);
            if (currentLocation.distance(pingLocation) > 10) {
                stopPingTimer();
            }
        });

        this.view.addEventListener("touchend", () => {
            stopPingTimer();
        });

        this.view.addEventListener("touchcancel", () => {
            stopPingTimer();
        });

        this.view.addEventListener("mouseup", () => {
            stopPingTimer();
        });

        this.view.addEventListener("mouseleave", () => {
            stopPingTimer();
        });
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

    containerFromLayerId(layer: number): CanvasContainer {
        let container: CanvasContainer;
        if (layer == Layer.BACKGROUND) {
            container = this.backgroundContainer;
        }
        else if (layer == Layer.DETAILS) {
            container = this.detailContainer;
        }
        else if (layer == Layer.CHARACTERS) {
            container = this.characterContainer;
        }
        else if (layer == Layer.EFFECTS) {
            container = this.effectContainer;
        }
        else {
            throw new Error(`invalid layer ID: ${layer}`);
        }
        return container;
    }

    async Ping(x: number, y: number) {
        const sprite = await this.effectContainer.DrawSprite({
            src: "/unknown.png",
            position: new Vector2(x, y),
            z: this.highestZIndex + 1,
            width: 1,
            height: 1,
            scaleType: ScaleType.Relative,
        });

        setTimeout(() => {
            sprite.removeFromParent();
        }, 1000);
    }

    async AddToken(token): Promise<CanvasContainer> {
        const container = this.containerFromLayerId(token.layer);
        const spriteOptions = {
            src: token.src,
            position: new Vector2(token.x, token.y),
            z: token.z,
            width: token.width,
            height: token.height,
            scaleType: token.scale_type,
            rotation: token.rotation,
        };
        const sprite = await container.DrawSprite(spriteOptions);
        if (token.z > this.highestZIndex) {
            this.highestZIndex = token.z;
        }
        const spriteContainer = new CanvasContainer(sprite);
        sprite.eventMode = 'static';

        this.tokenNodes[token.id] = sprite;

        const applySize = () => {
            if (token.scale_type == ScaleType.Absolute) {
                sprite.width = token.width;
                sprite.height = token.height;
            }
            else {
                sprite.scale.x = token.width;
                sprite.scale.y = token.height;
            }
        }

        sprite.on("resized", (attribute: string, value: number) => {
            token[attribute] = value;
            applySize();
        });

        let scaleTimeoutHandle: number;
        sprite.on("scale", (ev) => {
            if (ev.deltaY < 0) {
                token.width *= 1.05;
                token.height *= 1.05;
            }
            else {
                token.width *= 0.95;
                token.height *= 0.95;
            }
            applySize();

            clearTimeout(scaleTimeoutHandle);
            scaleTimeoutHandle = setTimeout(async () => {
                await ApiRequest("/map/update", {
                    id: this.id,
                    changes: {
                        "$set": {
                            [`tokens.${token.id}.width`]: token.width,
                            [`tokens.${token.id}.height`]: token.height,
                        },
                    },
                });
            }, 250);
        });

        let rotateTimeoutHandle: number;
        sprite.on("rotate", (ev) => {
            if (ev.deltaY > 0) {
                sprite.rotation += 0.261799;
            }
            else {
                sprite.rotation -= 0.261799;
            }

            clearTimeout(rotateTimeoutHandle);
            rotateTimeoutHandle = setTimeout(async () => {
                await ApiRequest("/map/update", {
                    id: this.id,
                    changes: {
                        "$set": {
                            [`tokens.${token.id}.rotation`]: sprite.rotation,
                        },
                    },
                });
            }, 250);
        });

        const spriteState = {
            dragging: false,
            hovered: false,
        }
        let label: PIXI.Text = null;

        const ClearLabel = () => {
            if (label !== null) {
                label.destroy();
                label = null;
            }
        }
        const DisplayLabel = () => {
            label = this.tokenContainer.AddText({
                position: new Vector2(sprite.x, sprite.y).add(new Vector2(0, token.hitbox_height / 2)),
                content: token.name,
                center: true,
            });
        }

        sprite.on("mouseenter", () => {
            spriteState.hovered = true;
            ClearLabel();
            if (!spriteState.dragging && token.character_id) {
                DisplayLabel();
            }
        });

        sprite.on("mouseleave", () => {
            spriteState.hovered = false;
            ClearLabel();
        });

        sprite.on("mousedown", (ev: MouseEvent) => {
            spriteState.dragging = true;
            ClearLabel();
            let spriteMoved = false;
            const dragOffset = this.ScreenToWorldCoords(new Vector2(ev.clientX, ev.clientY));
            dragOffset.applySubtract(new Vector2(sprite.position.x, sprite.position.y));
            sprite.zIndex = (++this.highestZIndex);

            const onDrag = (ev: MouseEvent) => {
                spriteMoved = true;
                const worldCoords = this.ScreenToWorldCoords(new Vector2(ev.clientX, ev.clientY));
                worldCoords.applySubtract(dragOffset);
                sprite.x = worldCoords.x;
                sprite.y = worldCoords.y;
            }

            const onDragEnd = async () => {
                spriteState.dragging = false;
                ClearLabel();
                if (spriteState.hovered && token.character_id) {
                    DisplayLabel();
                }
                document.removeEventListener("mousemove", onDrag);
                if (spriteMoved) {
                    await ApiRequest("/map/update", {
                        id: this.id,
                        changes: {
                            "$set": {
                                [`tokens.${token.id}.x`]: sprite.x,
                                [`tokens.${token.id}.y`]: sprite.y,
                                [`tokens.${token.id}.z`]: sprite.zIndex,
                            },
                        },
                    });
                }
                else {
                    // This sprite was clicked
                    if (token.character_id) {
                        await launchWindow("CharacterSheetWindow", { id: token.character_id });
                    }
                }
            }

            document.addEventListener("mousemove", onDrag);
            document.addEventListener("mouseup", onDragEnd, { once: true });
        });

        const setTokenLayer = async (layer: number) => {
            await ApiRequest("/map/update", {
                id: this.id,
                changes: {
                    "$set": {
                        [`tokens.${token.id}.layer`]: layer,
                    },
                },
            });
        }

        const contextOptions = {
            "Edit Token": {
                "Combat Tracker": async () => {
                    if (token.character_id) {
                        await ApiRequest("/combat/add-combatant", {
                            character_id: token.character_id,
                        });
                    }
                },
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
            },
        };
        if (Session.gm) {
            contextOptions["Change Layer"] = {
                "Background": () => { setTokenLayer(Layer.BACKGROUND); },
                "Details": () => { setTokenLayer(Layer.DETAILS); },
                "Characters": () => { setTokenLayer(Layer.CHARACTERS); },
                "Effects": () => { setTokenLayer(Layer.EFFECTS); },
            };
        }

        ContextMenu.set(sprite as any, contextOptions);

        return spriteContainer;
    }

    DeleteToken(id) {
        this.tokenNodes[id].destroy();
        delete this.tokenNodes[id];
    }

    async render(map, translation, scale) {
        this.id = map.id;
        this.squareSize = map.squareSize;

        if (this.tokenContainer) {
            this.tokenContainer.node.destroy();
        }
        if (this.grid) {
            this.grid.destroy();
        }

        const root = this.rootContainer;
        this.tokenContainer = root.AddContainer(translation, scale);
        this.backgroundContainer = this.tokenContainer.AddContainer();
        this.backgroundContainer.node.eventMode = "none";
        this.detailContainer = this.tokenContainer.AddContainer();
        this.detailContainer.node.eventMode = "none";
        this.characterContainer = this.tokenContainer.AddContainer();
        this.characterContainer.node.eventMode = "none";
        this.effectContainer = this.tokenContainer.AddContainer();
        this.effectContainer.node.eventMode = "none";
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
