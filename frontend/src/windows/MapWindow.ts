import * as PIXI from "pixi.js";

import { CanvasWindow, registerWindowType } from "./Window.ts";
import { Parameter, GenerateId, LocalPersist } from "../lib/Utils.ts";
import { Vector2 } from "../lib/Vector.ts";
import { ApiRequest, Session } from "../lib/Requests.ts";
import { ClearSelectedTokens, GetSelectedTokens, MapCanvas } from "../lib/Canvas.ts";
import { ErrorToast } from "../lib/Notifications.ts";
import { GridFilter } from "../filters/Grid.ts";
import { Button } from "../lib/Elements.ts";
import { Alignment, Layer } from "../lib/Enums.ts";
import { Character, Permission, ScaleType } from "../lib/Models.ts";
import { PCG } from "../lib/PcgRandom.ts";


type MapData = { x: number, y: number, scale: number };


export class MapWindow extends CanvasWindow {
    mapId: string;
    translation: Vector2;
    scale: number;
    viewChangesMade: boolean;
    buttonTray: HTMLDivElement;
    activeLayer: number;
    layerButtons: { [layer: number]: HTMLButtonElement };
    toolButtons: { [tool: string]: HTMLButtonElement };
    snapButton: HTMLButtonElement;
    declare canvas: MapCanvas;

    constructor(options = undefined) {
        options = Parameter(options, {});
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
        this.layerButtons = {};
        this.toolButtons = {};

        this.buttonTray = this.container.appendChild(document.createElement("div"));
        this.buttonTray.className = "buttonTray";

        if (Session.gm) {
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

            for (const button of this.buttonTray.children as HTMLCollectionOf<HTMLButtonElement>) {
                const layer = parseInt(button.dataset.id);
                this.layerButtons[layer] = button;
                button.addEventListener("click", () => {
                    this.setActiveLayer(layer);
                });
            }

            this.addToolButton("reveal", "eye");
            this.addToolButton("hide", "cloud");
        }

        this.addToolButton("ruler", "ruler");

        const snapButton = Button("frame");
        this.snapButton = snapButton;
        this.buttonTray.appendChild(snapButton);
        if (this.canvas.snapping) {
            snapButton.classList.add("active");
        }
        snapButton.addEventListener("click", () => {
            snapButton.classList.toggle("active");
            this.canvas.snapping = !this.canvas.snapping;
        });

        this.viewPort.addEventListener("contextmenu", ev => {
            ev.preventDefault();
            ev.stopPropagation();
        });

        this.viewPort.addEventListener("mousedown", (startEv: MouseEvent) => {
            let selectArea: PIXI.Graphics = null;
            let label: PIXI.Text = null;
            const element = this.canvas.getElementAtScreenPos(startEv.clientX, startEv.clientY);
            // Left-click on an element is already handed in Canvas.ts
            if (startEv.button == 0) {
                if (element) {
                    return;
                }
                else {
                    selectArea = new PIXI.Graphics();
                    label = new PIXI.Text();
                    label.style.align = "center";
                    label.anchor.set(0.5, 0.5);
                    label.style.fill = '#ffffff';
                    label.style.stroke = '#000000';
                    label.style.dropShadow = true;
                    label.style.fontSize = Math.max(18, 18 / this.scale);
                    this.canvas.uiContainer.node.addChild(selectArea);
                    this.canvas.uiContainer.node.addChild(label);
                    if (this.canvas.tool == null && !startEv.shiftKey) {
                        ClearSelectedTokens();
                    }
                }
            }
            let elementDragged = false;

            let previousX = startEv.clientX;
            let previousY = startEv.clientY;
            const startPosition = this.canvas.ScreenToWorldCoords(new Vector2(startEv.clientX, startEv.clientY));
            if (this.canvas.snapping) {
                startPosition.applyRound(this.canvas.squareSize / 2);
            }

            const onDrag = (dragEv: MouseEvent) => {
                const x = dragEv.clientX;
                const y = dragEv.clientY;
                const deltaX = x - previousX;
                const deltaY = y - previousY;
                previousX = x;
                previousY = y;
                if (selectArea) {
                    const rectStart = startPosition.copy();
                    const currentPosition = this.canvas.ScreenToWorldCoords(new Vector2(x, y));
                    if (this.canvas.snapping) {
                        currentPosition.applyRound(this.canvas.squareSize / 2);
                    }
                    const rectSize = currentPosition.subtract(startPosition);
                    if (rectSize.x < 0) {
                        rectStart.x += rectSize.x;
                        rectSize.x = Math.abs(rectSize.x);
                    }
                    if (rectSize.y < 0) {
                        rectStart.y += rectSize.y;
                        rectSize.y = Math.abs(rectSize.y);
                    }
                    selectArea.clear();
                    if (this.canvas.tool == "reveal") {
                        selectArea.rect(rectStart.x, rectStart.y, rectSize.x, rectSize.y);
                        selectArea.fill({ color: '#ffffff', alpha: 0.3 });
                    }
                    else if (this.canvas.tool == "hide") {
                        selectArea.rect(rectStart.x, rectStart.y, rectSize.x, rectSize.y);
                        selectArea.fill({ color: '#ffffff', alpha: 0.3 });
                    }
                    else if (this.canvas.tool == "ruler") {
                        const distance = currentPosition.distance(startPosition) / this.canvas.squareSize;
                        const labelPosition = startPosition.add(currentPosition).divide(2);
                        label.x = labelPosition.x;
                        label.y = labelPosition.y + 50;
                        label.text = `${(Math.round(distance * 10) / 10).toFixed(1)} sq.`;
                        selectArea.moveTo(startPosition.x, startPosition.y);
                        selectArea.lineTo(currentPosition.x, currentPosition.y);
                        selectArea.stroke({ width: 3 / this.scale, color: '#ffffff', alpha: 0.75 });
                    }
                    else {
                        selectArea.rect(rectStart.x, rectStart.y, rectSize.x, rectSize.y);
                        selectArea.stroke({ width: 3 / this.scale, color: '#ffffff', alpha: 0.75 });
                    }
                }
                if (startEv.button == 2) {
                    this.translate(deltaX, deltaY);
                }
                elementDragged = true;
            }

            const onDragEnd = async (endEv: MouseEvent) => {
                document.removeEventListener("mousemove", onDrag);
                if (selectArea) {
                    const rectStart = startPosition.copy();
                    const currentPosition = this.canvas.ScreenToWorldCoords(new Vector2(endEv.clientX, endEv.clientY));
                    if (this.canvas.snapping) {
                        currentPosition.applyRound(this.canvas.squareSize / 2);
                    }
                    const rectSize = currentPosition.subtract(startPosition);
                    if (rectSize.x < 0) {
                        rectStart.x += rectSize.x;
                        rectSize.x = Math.abs(rectSize.x);
                    }
                    if (rectSize.y < 0) {
                        rectStart.y += rectSize.y;
                        rectSize.y = Math.abs(rectSize.y);
                    }
                    selectArea.destroy();
                    label.destroy();
                    if (this.canvas.tool == "reveal") {
                        if (rectSize.x > 5 && rectSize.y > 5) {
                            const polygon = [
                                [rectStart.x, rectStart.y],
                                [rectStart.x+rectSize.x, rectStart.y],
                                [rectStart.x+rectSize.x, rectStart.y+rectSize.y],
                                [rectStart.x, rectStart.y+rectSize.y],
                                [rectStart.x, rectStart.y],
                            ];
                            await ApiRequest("/map/reveal", {
                                id: this.mapId,
                                area: polygon,
                            });
                        }
                    }
                    else if (this.canvas.tool == "hide") {
                        if (rectSize.x > 5 && rectSize.y > 5) {
                            const polygon = [
                                [rectStart.x, rectStart.y],
                                [rectStart.x+rectSize.x, rectStart.y],
                                [rectStart.x+rectSize.x, rectStart.y+rectSize.y],
                                [rectStart.x, rectStart.y+rectSize.y],
                                [rectStart.x, rectStart.y],
                            ];
                            await ApiRequest("/map/hide", {
                                id: this.mapId,
                                area: polygon,
                            });
                        }
                    }
                    else if (this.canvas.tool === null) {
                        const boundsRect = new PIXI.Rectangle(rectStart.x, rectStart.y, rectSize.x, rectSize.y);
                        const container = this.canvas.containerFromLayerId(this.activeLayer);
                        for (const node of container.node.children) {
                            if (node.label != "Sprite") {
                                continue;
                            }
                            if (boundsRect.contains(node.x, node.y)) {
                                this.canvas.selectedTokens.add(node as PIXI.Sprite);
                                this.canvas.onSelect(node as PIXI.Sprite);
                            }
                        }
                    }
                }
                // In-place click
                if (!elementDragged) {
                    // Right-click
                    if (startEv.button == 2) {
                        // World position that we right-clicked on
                        // const endPosition = this.canvas.ScreenToWorldCoords(new Vector2(endEv.clientX, endEv.clientY));

                        // Dispatch right-click on element to that element
                        if (element) {
                            element.emit("contextmenu", endEv);
                        }
                    }
                }
            }

            document.addEventListener("mousemove", onDrag);
            document.addEventListener("mouseup", onDragEnd, { once: true });
        });

        this.viewPort.addEventListener("wheel", ev => {
            if (ev.ctrlKey) {
                ev.preventDefault();
            }
            const element = this.canvas.getElementAtScreenPos(ev.clientX, ev.clientY);
            if (element && (ev.ctrlKey || ev.shiftKey)) {
                const selectedTokens = GetSelectedTokens();
                selectedTokens.add(element as PIXI.Sprite);
                if (ev.ctrlKey) {
                    for (const token of selectedTokens) {
                        token.emit("scale", ev);
                    }
                }
                else if (ev.shiftKey) {
                    for (const token of selectedTokens) {
                        token.emit("rotate", ev);
                    }
                }
            }
            else {
                let zoomDelta;
                if (ev.deltaY > 0) {
                    zoomDelta = 0.9;
                }
                else {
                    zoomDelta = 1.1;
                }
                this.zoom(zoomDelta);
            }
        });

        let touching = false;
        this.viewPort.addEventListener("touchstart", ev => {
            if (ev.touches.length != 2 || touching) {
                return;
            }

            touching = true;

            const abortController = new AbortController();

            let previousTouchPrimary = new Vector2(ev.touches[0].clientX, ev.touches[0].clientY);
            let previousTouchSecondary = new Vector2(ev.touches[1].clientX, ev.touches[1].clientY);
            let previousMagnitude = previousTouchPrimary.subtract(previousTouchSecondary).magnitude;

            const onTouchEnd = (_ev: TouchEvent) => {
                touching = false;
                abortController.abort();
            };

            const onTouch = (ev: TouchEvent) => {
                if (ev.touches.length != 2) {
                    onTouchEnd(ev);
                    return;
                }
                const touchPrimary = new Vector2(ev.touches[0].clientX, ev.touches[0].clientY);
                const touchSecondary = new Vector2(ev.touches[1].clientX, ev.touches[1].clientY);
                const magnitude = touchPrimary.subtract(touchSecondary).magnitude;

                const panDeltaX = (touchPrimary.x - previousTouchPrimary.x) + (touchSecondary.x - previousTouchSecondary.x);
                const panDeltaY = (touchPrimary.y - previousTouchPrimary.y) + (touchSecondary.y - previousTouchSecondary.y);
                const zoomDelta = magnitude - previousMagnitude;

                this.translate(panDeltaX, panDeltaY);
                this.zoom(1.0 + (zoomDelta / 250));

                previousMagnitude = magnitude;
                previousTouchPrimary = touchPrimary;
                previousTouchSecondary = touchSecondary;
            };

            document.addEventListener("touchmove", onTouch, { signal: abortController.signal });
            document.addEventListener("touchend", onTouchEnd, { signal: abortController.signal });
            document.addEventListener("touchcancel", onTouchEnd, { signal: abortController.signal });
        });
    }

    async zoom(delta: number) {
        this.translation.applySubtract(this.size.divide(2));
        this.scale *= delta;
        this.translation.applyMultiply(delta);
        this.translation.applyAdd(this.size.divide(2));
        this.applyScale();
        this.applyTranslation();
    }

    async onShare() {
        await ApiRequest("/map/update", {
            id: this.mapId,
            changes: {
                "$set": {
                    "permissions.*.*": Permission.Write,
                }
            }
        });
    }

    addToolButton(tool: string, icon: string): HTMLButtonElement {
        const toolButton = Button(icon);
        this.toolButtons[tool] = toolButton;
        this.buttonTray.appendChild(toolButton);
        if (this.canvas.tool == tool) {
            toolButton.classList.add("active");
        }
        toolButton.addEventListener("click", () => {
            this.setTool(tool);
        });
        return toolButton;
    }

    setTool(tool: string) {
        // Set tool and move active class as necessary
        const toolButton = this.toolButtons[tool];
        if (this.canvas.tool == tool) {
            toolButton.classList.remove("active");
            this.canvas.tool = null;
        }
        else if (this.canvas.tool !== null) {
            const oldButton = this.toolButtons[this.canvas.tool];
            oldButton.classList.remove("active");
            toolButton.classList.add("active");
            this.canvas.tool = tool;
        }
        else {
            toolButton.classList.add("active");
            this.canvas.tool = tool;
        }
        // While a tool is active, disable the active token container
        const container = this.canvas.containerFromLayerId(this.activeLayer);
        if (this.canvas.tool !== null) {
            container.node.eventMode = "none";
        }
        else {
            container.node.eventMode = "static";
        }
        // Dispatch onToolSelect callback
        this.canvas.onToolSelect();
    }

    setActiveLayer(layer: number) {
        if (this.activeLayer !== null) {
            const oldContainer = this.canvas.containerFromLayerId(this.activeLayer);
            oldContainer.node.eventMode = "none";
            if (Session.gm) {
                const oldActiveButton = this.layerButtons[this.activeLayer];
                oldActiveButton.classList.remove("active");
            }
        }
        const newContainer = this.canvas.containerFromLayerId(layer);
        if (this.canvas.tool === null) {
            newContainer.node.eventMode = "static";
        }
        if (Session.gm) {
            const newActiveButton = this.layerButtons[layer];
            newActiveButton.classList.add("active");
        }
        this.activeLayer = layer;
    }

    setSnap(value: boolean) {
        this.canvas.snapping = value;
        if (value) {
            this.snapButton.classList.add("active");
        }
        else {
            this.snapButton.classList.remove("active");
        }
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

    translate(x: number, y: number) {
        this.translation.x += x;
        this.translation.y += y;
        this.applyTranslation();
    }

    applyTranslation() {
        this.canvas.tokenContainer.node.x = this.translation.x;
        this.canvas.tokenContainer.node.y = this.translation.y;
        this.canvas.fogMask.x = this.translation.x;
        this.canvas.fogMask.y = this.translation.y;
        this.viewChangesMade = true;
        const gridFilter = this.canvas.grid.filters[0] as GridFilter;
        gridFilter.uniforms.uTranslation = new PIXI.Point(this.translation.x, this.translation.y);
    }

    applyScale() {
        this.canvas.tokenContainer.node.scale = this.scale;
        this.canvas.fogMask.scale = this.scale;
        this.viewChangesMade = true;
        const gridFilter = this.canvas.grid.filters[0] as GridFilter;
        gridFilter.uniforms.uScale = new PIXI.Point(this.scale, this.scale);
    }

    serialize() {
        return { mapId: this.mapId, activeLayer: this.activeLayer, tool: this.canvas.tool, snapping: this.canvas.snapping };
    }

    async deserialize(data) {
        await this.load(data.mapId, data.activeLayer, data.tool, data.snapping);
    }

    async load(id: string = null, activeLayer: number = null, tool: string = null, snapping: boolean = null) {
        this.options.backgroundColor = 0;

        await super.load();

        if (id !== null) {
            this.mapId = id;
        }
        if (snapping !== null) {
            this.setSnap(snapping);
        }
        if (tool !== null) {
            this.setTool(tool);
        }

        const response = await ApiRequest("/map/get", { id: this.mapId });
        if (response.status != "success") {
            ErrorToast("Failed to load map.");
            this.close();
            return;
        }
        const map = response.map;

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

        this.setTitle(`Map: ${map.name}`);
        await this.canvas.render(map, this.translation, this.scale);

        if (activeLayer !== null) {
            this.setActiveLayer(activeLayer);
        }
        else if (this.activeLayer === null) {
            this.setActiveLayer(Layer.CHARACTERS);
        }
        else {
            this.setActiveLayer(this.activeLayer);
        }

        this.addDropListener(this.viewPort, async (data, ev: MouseEvent) => {
            if (data.type == "file") {
                const worldCoords = this.canvas.ScreenToWorldCoords(new Vector2(ev.clientX, ev.clientY));
                const newId = GenerateId();
                await ApiRequest("/map/update", {
                    id: this.mapId,
                    changes: {
                        "$set": {
                            [`tokens.${newId}`]: {
                                id: newId,
                                src: data.urlPath,
                                x: worldCoords.x,
                                y: worldCoords.y,
                                z: ++this.canvas.highestZIndex,
                                layer: this.activeLayer,
                                width: 1,
                                height: 1,
                                scale_type: ScaleType.Relative,
                            },
                        },
                    }
                });
            }
            else if (data.type == "characterEntry" || data.type == "character") {
                let character: Character = null;
                if (data.type == "characterEntry") {
                    const getResponse: {
                        status: string;
                        character: Character;
                    } = await ApiRequest("/character/get", { id: data.id });
                    character = getResponse.character;
                }
                else if (data.type == "character") {
                    character = structuredClone(data.character);
                }

                if (character.alignment != Alignment.PLAYER) {
                    character.name = `${character.name} - ${PCG.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ" as any)}${PCG.choice("0123456789" as any)}`;
                    character.folder_id = null;
                    const createResponse: {
                        status: string;
                        id: string;
                    } = await ApiRequest("/character/create", {
                        document: character,
                    });
                    character.id = createResponse.id;
                }

                const worldCoords = this.canvas.ScreenToWorldCoords(new Vector2(ev.clientX, ev.clientY));
                const newId = GenerateId();
                await ApiRequest("/map/update", {
                    id: this.mapId,
                    changes: {
                        "$set": {
                            [`tokens.${newId}`]: {
                                id: newId,
                                src: character.image,
                                x: worldCoords.x,
                                y: worldCoords.y,
                                z: ++this.canvas.highestZIndex,
                                layer: this.activeLayer,
                                name: character.name,
                                width: character.size * map.squareSize * character.scale,
                                height: character.size * map.squareSize * character.scale,
                                hitbox_width: character.size * map.squareSize,
                                hitbox_height: character.size * map.squareSize,
                                character_id: character.id,
                                scale_type: ScaleType.Absolute,
                            },
                        },
                    }
                });
            }
        });

        await this.subscribe(this.mapId, async update => {
            if (update.type == "update") {
                if (Object.keys(update.changes).length == 1 && update.changes["$set"]) {
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
                            if (attribute == "x" || attribute == "y" || attribute == "rotation") {
                                sprite.parent.addChild(sprite);
                                sprite[attribute] = numericValue;
                            }
                            else if (attribute == "width" || attribute == "height") {
                                sprite.emit("resized", attribute, numericValue);
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
            }
            else if (update.type == "ping") {
                await this.canvas.Ping(update.x, update.y);
            }
        });
    }
}
registerWindowType(MapWindow);
