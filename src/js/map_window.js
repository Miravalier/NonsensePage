import { CanvasWindow } from "./window.js";
import { Parameter, AddDropListener } from "./utils.js";
import { Vector2 } from "./vector.js";
import { ApiRequest } from "./requests.js";


export class MapWindow extends CanvasWindow {
    constructor(options) {
        options.classList = ["map-window"];
        options.size = Parameter(options.size, new Vector2(800, 600));
        super(options);
    }

    async load(id) {
        await super.load();

        const response = await ApiRequest("/map/get", { id });
        if (response.status != "success") {
            ErrorToast("Failed to load map.");
            this.close();
            return;
        }

        console.log(response);
    }
}
