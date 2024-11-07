import { ContentWindow, registerWindowType } from "./Window.ts";
import { Vector2 } from "../lib/Vector.ts";
import { ApiRequest } from "../lib/Requests.ts";
import { ErrorToast } from "../lib/Notifications.ts";
import { IsDefined, Parameter, Require, TitleCase } from "../lib/Utils.ts";
import { Permission } from "../lib/Models.ts";
import { Sheet, SheetRegistry } from "../lib/Sheet.ts";


export class SheetWindow extends ContentWindow {
    entryType: string;
    id: string;
    sheet: Sheet

    constructor(options) {
        options.classList = ["sheet"];
        options.size = Parameter(options.size, new Vector2(540, 600));
        super(options);
        this.id = null;
        this.entryType = Require(options.entryType);
    }

    async onShare() {
        await ApiRequest(`/${this.entryType}/update`, {
            id: this.id,
            changes: {
                "$set": {
                    "permissions.*.*": Permission.Read,
                }
            }
        });
    }

    async load(id: string) {
        await super.load();
        this.content.innerHTML = "";

        if (IsDefined(id)) {
            this.id = id;
        }

        // Get entry data
        const response = await ApiRequest(`/${this.entryType}/get`, { id: this.id });

        if (response.status == "partial") {
            this.setTitle(response[this.entryType].name);
            const watermark = this.content.appendChild(document.createElement("div"));
            watermark.classList.add("watermark");
            watermark.textContent = "Insufficient Permissions";
            return;
        }

        if (response.status != "success") {
            ErrorToast(`${TitleCase(this.entryType)} loading failed!`);
            this.close();
            return;
        }
        const entry = response[this.entryType];
        this.setTitle(entry.name);

        // Load sheet content
        const sheetIdentifier = `${this.entryType}.${entry.sheet_type}`;
        let registeredSheet = SheetRegistry[sheetIdentifier];
        if (!registeredSheet) {
            ErrorToast(`Unrecognized sheet type: '${sheetIdentifier}'`);
            this.close();
        }
        const { type } = registeredSheet;
        const sheet = new type(this.entryType, entry.id, this);
        await sheet.init(entry);

        // Set up update watcher
        await this.subscribe(this.id, async broadcast => {
            if (broadcast.type == "update") {
                sheet.onUpdate(broadcast.changes);
            }
            else if (broadcast.type == "delete") {
                this.close();
            }
        });

        this.sheet = sheet;
    }

    serialize() {
        return { id: this.id, sheetData: this.sheet.serialize() };
    }

    async deserialize(data) {
        await this.load(data.id);
        await this.sheet.deserialize(data.sheetData);
    }
}
registerWindowType(SheetWindow);
