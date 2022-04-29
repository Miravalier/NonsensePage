import { Templates } from "./templates.js";

export default class GenericSheet {
    static async render(parent) {
        await Templates.loadCss("generic-sheet.css");
        parent.appendChild(await Templates.loadHtml("generic-sheet.html"));
    }
}
