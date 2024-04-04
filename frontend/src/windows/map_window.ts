import * as PIXI from "pixi.js";

import * as ContextMenu from "../lib/contextmenu.ts";
import { CanvasWindow, registerWindowType } from "./window.ts";
import { Parameter, GenerateId, LocalPersist } from "../lib/utils.ts";
import { Vector2 } from "../lib/vector.ts";
import { ApiRequest, Session } from "../lib/requests.ts";
import { MapCanvas } from "../lib/canvas.ts";
import { ErrorToast } from "../lib/notifications.ts";
import { GridFilter } from "../filters/grid.ts";
import { Button } from "../lib/elements.ts";
import { Layer } from "../lib/enums.ts";


type MapData = { x: number, y: number, scale: number };


export class MapWindow extends CanvasWindow {
    mapId: string;
    translation: Vector2;
    scale: number;
    viewChangesMade: boolean;
    buttonTray: HTMLDivElement;
    activeLayer: number;
    layerButtons: { [layer: number]: HTMLButtonElement };
    declare canvas: MapCanvas;

    constructor(options) {
        options.classList = ["map-window"];
        options.size = Parameter(options.size, new Vector2(800, 600));
        options.refreshable = Parameter(options.refreshable, true);
        options.canvasClass = Parameter(options.canvasClass, MapCanvas);
        super(options);
        this.activeLayer = null;
        this.mapId = null;
        this.translation = new Vector2(0, 0);
        this.scale = 1;
        this.viewChangesMade = false;

        this.buttonTray = this.container.appendChild(document.createElement("div"));
        this.buttonTray.className = "buttonTray";
        if (!Session.gm) {
            this.buttonTray.style.display = "none";
        }

        const backgroundLayerButton = Button("map");
        backgroundLayerButton.dataset.id = Layer.BACKGROUND.toString();
        this.buttonTray.appendChild(backgroundLayerButton);

        const detailLayerButton = Button("flag");
        detailLayerButton.dataset.id = Layer.DETAILS.toString();
        this.buttonTray.appendChild(detailLayerButton);

        const characterLayerButton = Button("person");
        characterLayerButton.dataset.id = Layer.CHARACTERS.toString();
        this.buttonTray.appendChild(characterLayerButton);

        const effectsLayerButton = Button("sparkles");
        effectsLayerButton.dataset.id = Layer.EFFECTS.toString();
        this.buttonTray.appendChild(effectsLayerButton);

        this.layerButtons = {};
        for (const button of this.buttonTray.children as HTMLCollectionOf<HTMLButtonElement>) {
            const layer = parseInt(button.dataset.id);
            this.layerButtons[layer] = button;
            button.addEventListener("click", () => {
                this.setActiveLayer(layer);
            });
        }

        this.viewPort.addEventListener("contextmenu", ev => {
            ev.preventDefault();
            ev.stopPropagation();
        });

        this.viewPort.addEventListener("mousedown", (ev: MouseEvent) => {
            if (ev.button != 2) {
                return;
            }

            ContextMenu.close();
            const boundary = new PIXI.EventBoundary(this.canvas.app.stage);
            const xOffset = this.container.offsetLeft + this.viewPort.offsetLeft;
            const yOffset = this.container.offsetTop + this.viewPort.offsetTop;
            const element = boundary.hitTest(ev.clientX - xOffset, ev.clientY - yOffset);
            let elementDragged = false;

            let previousX = ev.clientX - xOffset;
            let previousY = ev.clientY - yOffset;

            const onDrag = (ev: MouseEvent) => {
                const x = ev.clientX - xOffset;
                const y = ev.clientY - yOffset;
                const deltaX = x - previousX;
                const deltaY = y - previousY;
                previousX = x;
                previousY = y;
                this.translation.x += deltaX;
                this.translation.y += deltaY;
                this.applyTranslation();
                elementDragged = true;
            }

            const onDragEnd = () => {
                document.removeEventListener("mousemove", onDrag);
                if (element && !elementDragged) {
                    element.emit("contextmenu", ev);
                }
            }

            document.addEventListener("mousemove", onDrag);
            document.addEventListener("mouseup", onDragEnd, { once: true });
        });

        this.viewPort.addEventListener("wheel", ev => {
            this.translation.applySubtract(this.size.divide(2));
            if (ev.deltaY > 0) {
                this.scale *= 0.9;
                this.translation.applyMultiply(0.9);
            }
            else {
                this.scale *= 1.1;
                this.translation.applyMultiply(1.1);
            }
            this.translation.applyAdd(this.size.divide(2));
            this.applyScale();
            this.applyTranslation();
        });
    }

    setActiveLayer(layer: number) {
        if (this.activeLayer !== null) {
            const oldContainer = this.canvas.containerFromLayerId(this.activeLayer);
            oldContainer.node.eventMode = "none";
            const oldActiveButton = this.layerButtons[this.activeLayer];
            oldActiveButton.classList.remove("active");
        }
        const newContainer = this.canvas.containerFromLayerId(layer);
        newContainer.node.eventMode = "static";
        const newActiveButton = this.layerButtons[layer];
        newActiveButton.classList.add("active");
        this.activeLayer = layer;
    }

    toggleMinimize(): void {
        super.toggleMinimize();
        if (this.minimized) {
            this.buttonTray.style.display = "none";
        }
        else {
            this.buttonTray.style.display = null;
        }
    }

    applyTranslation() {
        this.canvas.tokenContainer.node.x = this.translation.x;
        this.canvas.tokenContainer.node.y = this.translation.y;
        this.viewChangesMade = true;
        const gridFilter = this.canvas.grid.filters[0] as GridFilter;
        gridFilter.uniforms.uTranslation = new PIXI.Point(this.translation.x, this.translation.y);
    }

    applyScale() {
        this.canvas.tokenContainer.node.scale.x = this.scale;
        this.canvas.tokenContainer.node.scale.y = this.scale;
        this.viewChangesMade = true;
        const gridFilter = this.canvas.grid.filters[0] as GridFilter;
        gridFilter.uniforms.uScale = new PIXI.Point(this.scale, this.scale);
    }

    serialize() {
        return { mapId: this.mapId, activeLayer: this.activeLayer };
    }

    async deserialize(data) {
        await this.load(data.mapId, data.activeLayer);
    }

    async load(id: string = null, activeLayer: number = null) {
        await super.load();

        if (id !== null) {
            this.mapId = id;
        }

        const response = await ApiRequest("/map/get", { id: this.mapId });
        if (response.status != "success") {
            ErrorToast("Failed to load map.");
            this.close();
            return;
        }

        const localMapData: MapData = LocalPersist.load(`map.${this.mapId}`, { x: null, y: null, scale: null });
        if (localMapData.x !== null) {
            this.translation.x = localMapData.x;
        }
        if (localMapData.y !== null) {
            this.translation.y = localMapData.y;
        }
        if (localMapData.scale !== null) {
            this.scale = localMapData.scale;
        }

        this.repeatFunction(() => {
            if (this.viewChangesMade) {
                LocalPersist.save(`map.${this.mapId}`, {
                    x: this.translation.x,
                    y: this.translation.y,
                    scale: this.scale,
                });
                this.viewChangesMade = false;
            }
        }, 1000);

        this.setTitle(`Map: ${response.map.name}`);
        await this.canvas.render(response.map, this.translation, this.scale);

        if (activeLayer !== null) {
            this.setActiveLayer(activeLayer);
        }
        else if (this.activeLayer === null) {
            this.setActiveLayer(Layer.CHARACTERS);
        }
        else {
            this.setActiveLayer(this.activeLayer);
        }

        this.addDropListener(this.viewPort, async (data, ev) => {
            if (data.type != "file") {
                return;
            }
            const worldCoords = this.canvas.ScreenToWorldCoords(new Vector2(ev.clientX, ev.clientY));
            const newId = GenerateId();
            await ApiRequest("/map/update", {
                id: this.mapId,
                changes: {
                    "$set": {
                        [`tokens.${newId}`]: {
                            id: newId,
                            src: data.path,
                            x: worldCoords.x,
                            y: worldCoords.y,
                            z: ++this.canvas.highestZIndex,
                            layer: this.activeLayer,
                        },
                    },
                }
            });
        });

        await this.subscribe(this.mapId, async update => {
            if (update.type == "update"
                && Object.keys(update.changes).length == 1
                && update.changes["$set"]) {

                const changes = update.changes["$set"];
                let simpleChanges = true;

                for (const [key, value] of Object.entries(changes)) {
                    if (key.startsWith("tokens.")) {
                        const [upperAttr, tokenId, attribute] = key.split(".");
                        if (upperAttr != "tokens" || !tokenId || !attribute) {
                            simpleChanges = false;
                            break;
                        }
                        const sprite = this.canvas.tokenNodes[tokenId];
                        const numericValue = value as number;
                        if (attribute == "x" || attribute == "y") {
                            sprite.parent.addChild(sprite);
                            sprite[attribute] = numericValue;
                        }
                        else if (attribute == "z") {
                            sprite.zIndex = numericValue;
                            if (numericValue > this.canvas.highestZIndex) {
                                this.canvas.highestZIndex = numericValue;
                            }
                        }
                        else {
                            simpleChanges = false;
                            break;
                        }
                    }
                    else if (key == "squareSize") {
                        const gridFilter = this.canvas.grid.filters[0] as GridFilter;
                        gridFilter.uniforms.uPitch = new PIXI.Point(value as number, value as number);
                    }
                    else {
                        simpleChanges = false;
                        break;
                    }
                }
                if (simpleChanges) {
                    return;
                }
            }

            this.refresh();
        });
    }
}
registerWindowType(MapWindow);
