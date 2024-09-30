import { ContentWindow, registerWindowType } from "./Window.ts";
import { Vector2 } from "../lib/Vector.ts";
import { ApiRequest } from "../lib/Requests.ts";
import { ErrorToast } from "../lib/Notifications.ts";
import { IsDefined, Parameter } from "../lib/Utils.ts";
import { Note, Permission } from "../lib/Models.ts";
import { Html } from "../lib/Elements.ts";
import * as ContextMenu from "../lib/ContextMenu.ts";
import { marked } from "marked";


export class NoteWindow extends ContentWindow {
    noteId: string;
    editMode: boolean;

    constructor(options = undefined) {
        options = Parameter(options, {});
        options.classList = ["note"];
        options.size = Parameter(options.size, new Vector2(540, 600));
        super(options);
        this.noteId = null;
        this.editMode = false;
    }

    async onShare() {
        await ApiRequest("/note/update", {
            id: this.noteId,
            changes: {
                "$set": {
                    "permissions.*.*": Permission.Read,
                }
            }
        });
    }

    async load(id: string = undefined, editMode: boolean = undefined) {
        await super.load();
        this.content.innerHTML = "";
        if (IsDefined(id)) {
            this.noteId = id;
        }
        if (IsDefined(editMode)) {
            this.editMode = editMode;
        }

        // Get note data
        const response: {
            status: string;
            note: Note;
        } = await ApiRequest("/note/get", { id: this.noteId });

        if (response.status == "partial") {
            this.setTitle(response.note.name);
            const watermark = this.content.appendChild(document.createElement("div"));
            watermark.classList.add("watermark");
            watermark.textContent = "Insufficient Permissions";
            return;
        }

        if (response.status != "success") {
            ErrorToast("Note loading failed!");
            this.close();
            return;
        }
        const note = response.note;
        this.setTitle(note.name);
        if (note.text.length == 0) {
            this.editMode = true;
        }

        if (this.editMode) {
            const textArea = this.content.appendChild(Html(`<textarea class="text"></div>`)) as HTMLTextAreaElement;
            textArea.value = note.text;
            textArea.addEventListener("change", async () => {
                await ApiRequest("/note/update", { id: this.noteId, changes: { "$set": { "text": textArea.value } } });
            });
            const finishButton = this.content.appendChild(Html(`<button type="button">Finish</button>`));
            finishButton.addEventListener("click", async () => {
                this.editMode = false;
                this.refresh();
            });
        }
        else {
            const textDisplay = this.content.appendChild(Html(`<div class="text"></div>`)) as HTMLDivElement;
            textDisplay.innerHTML = await marked.parse(note.text, { breaks: true, async: true });
            this.abortControllers.push(ContextMenu.set(this.viewPort, {
                "Note": {
                    "Edit as Markdown": () => {
                        this.editMode = true;
                        this.refresh();
                    },
                }
            }));
        }

        // Set up update watcher
        await this.subscribe(this.noteId, async broadcast => {
            if (broadcast.type == "update") {
                if (this.editMode == false) {
                    this.refresh();
                }
            }
            else if (broadcast.type == "delete") {
                this.close();
            }
        });
    }

    serialize() {
        return { noteId: this.noteId, editMode: this.editMode };
    }

    async deserialize(data) {
        await this.load(data.noteId, data.editMode);
    }
}
registerWindowType(NoteWindow);
