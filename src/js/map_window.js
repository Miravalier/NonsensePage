import * as ContextMenu from "./contextmenu.js";
import { CanvasWindow } from "./window.js";
import { Parameter, GenerateId } from "./utils.js";
import { Vector2 } from "./vector.js";
import { ApiRequest } from "./requests.js";
import { MapCanvas } from "./canvas.js";


export class MapWindow extends CanvasWindow {
    constructor(options) {
        options.classList = ["map-window"];
        options.size = Parameter(options.size, new Vector2(800, 600));
        options.refreshable = Parameter(options.refreshable, true);
        options.canvasClass = Parameter(options.canvasClass, MapCanvas);
        super(options);
        this.id = null;
        this.translation = new Vector2(0, 0);
        this.scale = 1;

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
    }

    applyScale() {
        this.canvas.tokenContainer.node.scale.x = this.scale;
        this.canvas.tokenContainer.node.scale.y = this.scale;
    }

    async load(id) {
        await super.load();
        if (id) {
            this.id = id;
        }

        const response = await ApiRequest("/map/get", { id: this.id });
        if (response.status != "success") {
            ErrorToast("Failed to load map.");
            this.close();
            return;
        }

        this.setTitle(`Map: ${response.map.name}`);
        await this.canvas.render(response.map);
        this.applyTranslation();
        this.applyScale();

        this.addDropListener(this.viewPort, async (data, ev) => {
            if (data.type != "file") {
                return;
            }
            const worldCoords = this.canvas.ScreenToWorldCoords(new Vector2(ev.clientX, ev.clientY));
            const newId = GenerateId();
            await ApiRequest("/map/update", {
                id: this.id,
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

        await this.subscribe(this.id, async update => {
            if (update.type == "update"
                && Object.keys(update.changes).length == 1
                && update.changes["$set"]) {

                const changes = update.changes["$set"];
                let onlyTokenChanges = true;
                for (const [key, value] of Object.entries(changes)) {
                    const [upperAttr, tokenId, attribute] = key.split(".");
                    if (upperAttr != "tokens" || !tokenId || !attribute) {
                        onlyTokenChanges = false;
                        break;
                    }
                    if (attribute == "x" || attribute == "y") {
                        this.canvas.tokenNodes[tokenId][attribute] = value;
                    }
                    else {
                        onlyTokenChanges = false;
                        break;
                    }
                }
                if (onlyTokenChanges) {
                    return;
                }
            }

            this.refresh();
        });
    }
}
