import { Sheet } from "./sheet.js";


export default class GenericSheet extends Sheet {
    addListeners() {
        this.nameInput = this.registerBatchedInput("input.name", "name");
        this.hpInput = this.registerInput("input.hp", "hp");
        this.maxHpInput = this.registerInput("input.max-hp", "max_hp");
        this.sizeInput = this.registerInput("select.size", "size");
        this.scaleInput = this.registerInput("input.scale", "scale");
        this.description = this.registerBatchedInput("textarea.description", "description");

        this.token = this.window.content.querySelector("img.token");
        this.createStatButton = this.window.content.querySelector("button.create-stat");
        this.createItemButton = this.window.content.querySelector("button.create-item");
        this.statContainer = this.window.content.querySelector(".stats.inner");
        this.itemContainer = this.window.content.querySelector(".items.inner");
        super.addListeners()
    }

    update(data) {
        super.update(data);
    }
}
