import * as ContextMenu from "./contextmenu.js";
import { ApiRequest } from "./requests.js";
import { ContentWindow, Dialog } from "./window.js";
import { Parameter, AddDragListener } from "./utils.js";
import { Vector2 } from "./vector.js";
import { ErrorToast } from "./notifications.js";
import { Html } from "./elements.js";
import { MapWindow } from "./map_window.js";


export class MapListWindow extends ContentWindow {
    constructor(options) {
        options.classList = ["map-list-window"];
        options.refreshable = Parameter(options.refreshable, true);
        options.size = Parameter(options.size, new Vector2(300, 400));
        super(options);
        this.maps = this.content.appendChild(Html(`<div class="maps"></div>`));
        this.createMapButton = this.content.appendChild(Html(`
            <button class="create-map" type="button">Create Map</button>
        `))
        this.createMapButton.addEventListener("click", async () => {
            await ApiRequest("/map/create");
        });
    }

    async addMap(id, name) {
        const element = this.maps.appendChild(Html(`
            <div class="map" data-id="${id}">${name}</div>
        `));
        element.addEventListener("click", async (ev) => {
            const mapWindow = new MapWindow({
                title: `Map: ${name}`,
            });
            await mapWindow.load(id);
        });
        AddDragListener(element, { type: "map", id });
        ContextMenu.set(element, {
            "Edit Map": {
                "Rename": async (ev) => {
                    const nameInput = Html(`<input type="text" maxlength="128">`);
                    const renameButton = Html(`<button type="button">Rename</button>`);
                    const cancelButton = Html(`<button type="button">Cancel</button>`);
                    const dialog = new Dialog({
                        title: `Rename Map`,
                        elements: [
                            nameInput,
                            [renameButton, cancelButton]
                        ]
                    });
                    renameButton.addEventListener("click", async () => {
                        if (nameInput.value) {
                            await ApiRequest("/map/update", {
                                id,
                                changes: {
                                    "$set": {
                                        name: nameInput.value,
                                    },
                                },
                            });
                            element.textContent = nameInput.value;
                        }
                        dialog.close();
                    });
                    cancelButton.addEventListener("click", () => {
                        dialog.close();
                    });
                },
                "Delete": async (ev) => {
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
