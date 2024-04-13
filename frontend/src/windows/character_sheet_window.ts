import { ContentWindow, registerWindowType } from "./window.ts";
import { Vector2 } from "../lib/vector.ts";
import { ApiRequest } from "../lib/requests.ts";
import { ErrorToast } from "../lib/notifications.ts";
import { Parameter } from "../lib/utils.ts";
import { Character, Permission } from "../lib/models.ts";
import { Sheet, SheetRegistry } from "../lib/sheet.ts";


export class CharacterSheetWindow extends ContentWindow {
    characterId: string;
    sheet: Sheet

    constructor(options) {
        options.classList = ["character"];
        options.size = Parameter(options.size, new Vector2(540, 600));
        super(options);
        this.characterId = null;
    }

    async onShare() {
        await ApiRequest("/character/update", {
            id: this.characterId,
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
        this.characterId = id;

        // Get character data
        const response: {
            status: string;
            character: Character;
        } = await ApiRequest("/character/get", { id });

        if (response.status == "partial") {
            this.setTitle(response.character.name);
            const watermark = this.content.appendChild(document.createElement("div"));
            watermark.classList.add("watermark");
            watermark.textContent = "Insufficient Permissions";
            return;
        }

        if (response.status != "success") {
            ErrorToast("Character loading failed!");
            this.close();
            return;
        }
        const character = response.character;
        this.setTitle(character.name);

        // Load sheet content
        let registeredSheet = SheetRegistry[character.sheet_type];
        if (!registeredSheet) {
            registeredSheet = SheetRegistry.default;
        }
        const { type } = registeredSheet;
        const sheet = new type(character.id, this);
        await sheet.init(character);

        // Set up update watcher
        await this.subscribe(id, async update => {
            sheet.onUpdate(update.changes);
        });
    }

    serialize() {
        return { characterId: this.characterId };
    }

    async deserialize(data) {
        await this.load(data.characterId);
    }
}
registerWindowType(CharacterSheetWindow);
