import * as ContextMenu from "../lib/ContextMenu.ts";
import { ContentWindow, InputDialog, registerWindowType } from "./Window.ts";
import { ApiRequest, Session, FileUpload } from "../lib/Requests.ts";
import { Vector2 } from "../lib/Vector.ts";
import { Parameter, Leaf, Parent, PathConcat, GetThumbnail } from "../lib/Utils.ts";
import { ErrorToast } from "../lib/Notifications.ts";
import { AddDragListener } from "../lib/Drag.ts";
import { FileViewer } from "./FileViewer.ts";


const FILE_ICONS = {
    "directory": "folder",
    "image": "file-image",
    "text": "file-lines",
    "code": "file-code",
    "video": "file-video",
    "audio": "file-audio",
    "font": "book-font",
    "pdf": "file-pdf",
    "csv": "file-csv",
    "exe": "file-exclamation",
    "archive": "file-zipper",
    "binary": "file-binary",
};


export class FileWindow extends ContentWindow {
    fileNames: Set<string>;
    files: HTMLDivElement;
    buttons: HTMLDivElement;
    uploadFileButton: HTMLButtonElement;
    createFolderButton: HTMLButtonElement;
    filePicker: HTMLInputElement;
    viewSelect: HTMLSelectElement;
    path: string;
    view: string;

    constructor(options) {
        options.classList = ["file"];
        options.size = Parameter(options.size, new Vector2(400, 400));
        options.refreshable = Parameter(options.refreshable, true);
        options.title = Parameter(options.title, "Files");
        super(options);

        this.fileNames = new Set();
        this.files = this.content.appendChild(document.createElement("div"));
        this.files.className = "files";

        this.buttons = this.content.appendChild(document.createElement("div"));
        this.buttons.className = "buttons";

        this.uploadFileButton = this.buttons.appendChild(document.createElement("button"));
        this.uploadFileButton.type = "button";
        this.uploadFileButton.className = "upload-file";
        this.uploadFileButton.appendChild(document.createTextNode("Upload File"));
        this.uploadFileButton.addEventListener("click", () => {
            if (this.filePicker) {
                this.filePicker.remove();
            }
            this.filePicker = document.createElement("input");
            this.filePicker.type = "file";
            this.filePicker.style.display = "none";
            this.content.appendChild(this.filePicker);

            this.filePicker.addEventListener("change", async () => {
                for (let file of this.filePicker.files) {
                    await FileUpload(file, this.path);
                }
            });
            this.filePicker.click();
        });

        this.createFolderButton = this.buttons.appendChild(document.createElement("button"));
        this.createFolderButton.type = "button";
        this.createFolderButton.className = "create-folder";
        this.createFolderButton.appendChild(document.createTextNode("Create Folder"));
        this.createFolderButton.addEventListener("click", async () => {
            const selection = await InputDialog("Create Folder", { "Name": "text" }, "Create");
            if (!selection || !selection.Name) {
                return;
            }
            if (this.fileNames.has(selection.Name)) {
                ErrorToast("Error: A file or directory already exists with that name");
            }
            await ApiRequest("/files/mkdir", {
                name: selection.Name,
                path: this.path,
            });
        });

        this.viewSelect = this.buttons.appendChild(document.createElement("select"));
        this.viewSelect.innerHTML = `
            <option value="detail">Detail</option>
            <option value="images">Images</option>
        `;
        this.viewSelect.addEventListener("change", () => {
            this.view = this.viewSelect.value;
            if (this.view != "detail") {
                this.files.classList.remove("detail");
            }
            if (this.view != "images") {
                this.files.classList.remove("images");
            }
            this.files.classList.add(this.view);
        });
        this.view = "detail";
        this.path = "/";
    }

    refresh() {
        this.load(this.path, this.view);
    }

    async load(path: string, view: string = null) {
        await super.load();
        this.files.innerHTML = "";
        this.fileNames = new Set();

        const response = await ApiRequest("/files/list", { path });
        if (response.status != "success") {
            this.files.className = "files-error";
            this.files.appendChild(document.createTextNode(`Error: Failed to load files at '${path}'`));
            return;
        }
        this.path = response.path;
        if (view) {
            this.view = view;
        }
        this.viewSelect.value = this.view;

        if (this.view != "detail") {
            this.files.classList.remove("detail");
        }
        if (this.view != "images") {
            this.files.classList.remove("images");
        }
        this.files.classList.add(this.view);

        this.setTitle(`Files - ${response.path}`);
        if (response.path != "/") {
            this.addFolder("folder-arrow-up", "..", response.path + "/..");
        }

        for (const [filetype, path] of response.files) {
            const name = path.split("/").at(-1);
            if (filetype == "directory") {
                this.addFolder("folder", name, path);
            }
            else {
                const img = FILE_ICONS[filetype.split("/").at(0)];
                this.addFile(filetype, img, name, path);
            }
        }

        await this.subscribe("files", () => {
            this.refresh();
        });
    }

    serialize() {
        return { path: this.path, view: this.view };
    }

    async deserialize(data) {
        await this.load(data.path, data.view);
    }

    addFolder(img, name, path) {
        this.fileNames.add(name);
        const icon = document.createElement("i");
        icon.className = `fa-solid fa-${img}`;

        const item = this.files.appendChild(document.createElement("div"));
        item.className = "item directory";

        const nameElement = item.appendChild(document.createElement("div"));
        nameElement.className = "name";
        nameElement.appendChild(icon);
        nameElement.appendChild(document.createTextNode(name));

        this.addDropListener(item, async (data) => {
            if (data.type != "file") {
                return;
            }
            await ApiRequest("/files/move", {
                src: data.path,
                dst: PathConcat(path, Leaf(data.path)),
            });
        });

        if (name != "..") {
            ContextMenu.set(nameElement, {
                "Edit Directory": {
                    "Delete": async () => {
                        await ApiRequest("/files/delete", { path });
                    },
                    "Rename": async () => {
                        const response = await InputDialog(`Rename ${path}`, { "New Name": "text" }, "Rename");
                        await ApiRequest("/files/move", {
                            src: path,
                            dst: PathConcat(Parent(path), response["New Name"]),
                        });
                    },
                }
            });
        }

        nameElement.addEventListener("click", () => {
            this.load(path);
        });
    }

    async addFile(filetype: string, img: string, name: string, path: string) {
        this.fileNames.add(name);
        let urlPath = null;
        if (Session.gm) {
            urlPath = `/files${path}`;
        }
        else {
            urlPath = `/files/users/${Session.username}${path}`;
        }

        let icon;
        if (filetype.startsWith("image/")) {
            const thumbnail = await GetThumbnail(urlPath);
            icon = document.createElement("img");
            icon.classList = "thumbnail";
            icon.src = thumbnail;
        }
        else {
            icon = document.createElement("i");
            icon.classList = `fa-solid fa-${img}`;
        }

        const item = this.files.appendChild(document.createElement("div"));
        item.className = "item file";

        const nameElement = item.appendChild(document.createElement("div"));
        nameElement.className = "name";
        nameElement.appendChild(icon);
        nameElement.appendChild(document.createTextNode(name));

        AddDragListener(nameElement, { type: "file", filetype, urlPath, path });

        nameElement.addEventListener("click", () => {
            const fileViewer = new FileViewer();
            fileViewer.load(urlPath);
        });

        ContextMenu.set(nameElement, {
            "Edit File": {
                "Delete": async () => {
                    await ApiRequest("/files/delete", { path });
                },
                "Rename": async () => {
                    const response = await InputDialog(`Rename ${path}`, { "New Name": "text" }, "Rename");
                    await ApiRequest("/files/move", {
                        src: path,
                        dst: PathConcat(Parent(path), response["New Name"]),
                    });
                },
            }
        });
    }
}
registerWindowType(FileWindow);
