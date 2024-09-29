import { registerWindowType } from "./Window.ts";
import { EntryListWindow } from "./EntryList.ts";
import { NoteWindow } from "./NoteWindow.ts";


export class NoteListWindow extends EntryListWindow {
    constructor(options) {
        options.classList = ["note-list"];
        options.entryType = "note";
        super(options);
    }

    async openEntryHandler(id: string) {
        const noteWindow = new NoteWindow({
            title: "Note",
        });
        await noteWindow.load(id);
    }
}

registerWindowType(NoteListWindow);
