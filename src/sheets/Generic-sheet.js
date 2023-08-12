import { GenerateId } from "./utils.js";
import { Sheet } from "./sheet.js";
import { Html } from "./elements.js";


export default class GenericSheet extends Sheet {
    onLoad(data) {
        super.onLoad(data);

        this.statContainer = this.window.content.querySelector(".stats.inner");
        this.itemContainer = this.window.content.querySelector(".items.inner");

        for (const statId of data.stat_order) {
            const stat = data.stat_map[statId];
            this.statContainer.appendChild(Html(`
                <div class="stat" data-id="${stat.id}">
                    <span class="name">${stat.name}</span>
                </div>
            `));
        }

        for (const itemId of data.item_order) {
            const item = data.item_map[itemId];
            this.itemContainer.appendChild(Html(`
                <div class="item" data-id="${item.id}">
                    <span class="name">${item.name}</span>
                </div>
            `));
        }
    }

    addListeners() {
        super.addListeners();

        this.nameInput = this.registerBatchedInput("input.name", "name");
        this.hpInput = this.registerInput("input.hp", "hp");
        this.maxHpInput = this.registerInput("input.max-hp", "max_hp");
        this.sizeInput = this.registerInput("select.size", "size");
        this.scaleInput = this.registerInput("input.scale", "scale");
        this.description = this.registerBatchedInput("textarea.description", "description");

        this.token = this.registerImageInput("img.token", "image");

        /** @type {HTMLButtonElement} */
        this.createStatButton = this.window.content.querySelector("button.create-stat");
        this.createStatButton.addEventListener("click", async ev => {
            const newId = GenerateId();
            await ApiRequest("/character/update", {
                id: this.id,
                changes: {
                    "$set": {
                        [`stat_map.${newId}`]: {
                            id: newId,
                            name: "New Stat",
                            value: 0,
                        },
                    },
                    "$push": {
                        stat_order: newId,
                    },
                },
            });
        });

        /** @type {HTMLButtonElement} */
        this.createItemButton = this.window.content.querySelector("button.create-item");
        this.createItemButton.addEventListener("click", async ev => {
            const newId = GenerateId();
            await ApiRequest("/character/update", {
                id: this.id,
                changes: {
                    "$set": {
                        [`item_map.${newId}`]: {
                            id: newId,
                            name: "New Item",
                        },
                    },
                    "$push": {
                        item_order: newId,
                    },
                },
            });
        });
    }
}
