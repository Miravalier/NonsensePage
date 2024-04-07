import * as ContextMenu from "../lib/contextmenu.ts";
import { ApiRequest, Session } from "../lib/requests.ts";
import { ContentWindow, InputDialog, registerWindowType } from "./window.ts";
import { Parameter, AddDragListener } from "../lib/utils.ts";
import { Vector2 } from "../lib/vector.ts";
import { ErrorToast } from "../lib/notifications.ts";
import { Html } from "../lib/elements.ts";
import { MapWindow } from "./map_window.ts";


export class MapListWindow extends ContentWindow {
    maps: HTMLDivElement;
    createMapButton: HTMLButtonElement | null;

    constructor(options: any) {
        options.classList = ["map-list-window"];
        options.refreshable = Parameter(options.refreshable, true);
        options.size = Parameter(options.size, new Vector2(300, 400));
        options.title = Parameter(options.title, "Maps");
        super(options);
        this.maps = this.content.appendChild(Html(`<div class="maps"></div>`) as HTMLDivElement);
        this.createMapButton = null;
        if (Session.gm) {
            this.createMapButton = this.content.appendChild(Html(`
                <button class="create-map" type="button">Create Map</button>
            `) as HTMLButtonElement)
            this.createMapButton.addEventListener("click", async () => {
                await ApiRequest("/map/create");
            });
        }
    }

    async addMap(id, name) {
        const element = this.maps.appendChild(Html(`
            <div class="map" data-id="${id}">${name}</div>
        `));
        element.addEventListener("click", async () => {
            const mapWindow = new MapWindow({
                title: `Map: ${name}`,
            });
            await mapWindow.load(id);
        });
        AddDragListener(element, { type: "map", id });
        ContextMenu.set(element, {
            "Edit Map": {
                "Rename": async () => {
                    const selection = await InputDialog("Rename Map", { "Name": "text" }, "Rename");
                    if (!selection || !selection.Name) {
                        return;
                    }
                    await ApiRequest("/map/update", {
                        id,
                        changes: {
                            "$set": {
                                name: selection.Name,
                            },
                        },
                    });
                    element.textContent = selection.Name;
                },
                "Delete": async () => {
                    await ApiRequest("/map/delete", { id });
                    element.remove();
                },
            },
        });
    }

    async load() {
        await super.load();
        this.maps.innerHTML = "";

        const response = await ApiRequest("/map/list");
        if (response.status != "success") {
            ErrorToast("Failed to load map list.");
            this.close();
            return;
        }

        for (let [id, name] of response.maps) {
            await this.addMap(id, name);
        }

        await this.subscribe("maps", async updateData => {
            if (updateData.type == "delete") {
                const mapDiv = this.maps.querySelector(`[data-id="${updateData.id}"]`);
                if (mapDiv) {
                    mapDiv.remove();
                }
            }
            if (updateData.type == "create") {
                await this.addMap(updateData.id, updateData.name);
            }
        });
    }
}
registerWindowType(MapListWindow);
