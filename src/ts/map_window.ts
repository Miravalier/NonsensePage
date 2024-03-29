import * as ContextMenu from "./contextmenu.js";
import { CanvasWindow, registerWindowType } from "./window.js";
import { Parameter, GenerateId, LocalPersist } from "./utils.js";
import { Vector2 } from "./vector.js";
import { ApiRequest } from "./requests.js";
import { MapCanvas } from "./canvas.js";
import { ErrorToast } from "./notifications.js";


declare const PIXI: any;
type MapData = { x: number, y: number, scale: number };


export class MapWindow extends CanvasWindow {
    mapId: string;
    translation: Vector2;
    scale: number;
    viewChangesMade: boolean;
    canvas: MapCanvas;

    constructor(options) {
        options.classList = ["map-window"];
        options.size = Parameter(options.size, new Vector2(800, 600));
        options.refreshable = Parameter(options.refreshable, true);
        options.canvasClass = Parameter(options.canvasClass, MapCanvas);
        super(options);
        this.mapId = null;
        this.translation = new Vector2(0, 0);
        this.scale = 1;
        this.viewChangesMade = false;

        this.viewPort.addEventListener("contextmenu", ev => {
            ev.preventDefault();
            ev.stopPropagation();
            ContextMenu.close();
            const boundary = new PIXI.EventBoundary(this.canvas.app.stage);
            const xOffset = this.container.offsetLeft + this.viewPort.offsetLeft;
            const yOffset = this.container.offsetTop + this.viewPort.offsetTop;
            const element = boundary.hitTest(ev.clientX - xOffset, ev.clientY - yOffset);
            if (element) {
                element.emit("contextmenu", ev);
            }
        });

        this.viewPort.addEventListener("mousedown", ev => {
            if (ev.button != 2) {
                return;
            }

            const xOffset = this.container.offsetLeft + this.viewPort.offsetLeft;
            const yOffset = this.container.offsetTop + this.viewPort.offsetTop;
            let previousX = ev.clientX - xOffset;
            let previousY = ev.clientY - yOffset;

            const onDrag = ev => {
                const x = ev.clientX - xOffset;
                const y = ev.clientY - yOffset;
                const deltaX = x - previousX;
                const deltaY = y - previousY;
                previousX = x;
                previousY = y;
                this.translation.x += deltaX;
                this.translation.y += deltaY;
                this.applyTranslation();
            }

            const onDragEnd = ev => {
                document.removeEventListener("mousemove", onDrag);
            }

            document.addEventListener("mousemove", onDrag);
            document.addEventListener("mouseup", onDragEnd, { once: true });
        });

        this.viewPort.addEventListener("wheel", ev => {
            if (ev.deltaY > 0) {
                this.scale *= 0.9;
            }
            else {
                this.scale *= 1.1;
            }
            this.applyScale();
        });
    }

    applyTranslation() {
        this.canvas.tokenContainer.node.x = this.translation.x;
        this.canvas.tokenContainer.node.y = this.translation.y;
        this.viewChangesMade = true;
        const gridFilter = this.canvas.grid.filters[0];
        gridFilter.uniforms.translation = [this.translation.x, this.translation.y];
    }

    applyScale() {
        this.canvas.tokenContainer.node.scale.x = this.scale;
        this.canvas.tokenContainer.node.scale.y = this.scale;
        this.viewChangesMade = true;
        const gridFilter = this.canvas.grid.filters[0];
        gridFilter.uniforms.scale = [this.scale, this.scale];
    }

    async load(id) {
        await super.load();
        if (id) {
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
                        if (attribute == "x" || attribute == "y") {
                            this.canvas.tokenNodes[tokenId][attribute] = value;
                        }
                        else {
                            simpleChanges = false;
                            break;
                        }
                    }
                    else if (key == "squareSize") {
                        const gridFilter = this.canvas.grid.filters[0];
                        gridFilter.uniforms.pitch = [value, value];
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
