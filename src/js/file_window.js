import { ContentWindow, ConfirmDialog, Dialog } from "./window.js";
import { ApiRequest, Session, FileUpload } from "./requests.js";
import { Vector2 } from "./vector.js";
import { Button } from "./elements.js";
import { Parameter, AddDragListener } from "./utils.js";


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
    constructor(options) {
        options.classList = ["file"];
        options.size = Parameter(options.size, new Vector2(400, 400));
        options.refreshable = Parameter(options.refreshable, true);
        super(options);

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
                await this.load(this.path);
            });
            this.filePicker.click();
        });

        this.createFolderButton = this.buttons.appendChild(document.createElement("button"));
        this.createFolderButton.type = "button";
        this.createFolderButton.className = "create-folder";
        this.createFolderButton.appendChild(document.createTextNode("Create Folder"));
        this.createFolderButton.addEventListener("click", () => {
            const folderName = document.createElement("input");
            folderName.type = "text";

            const createButton = document.createElement("button");
            createButton.appendChild(document.createTextNode("Create"));

            const cancelButton = document.createElement("button");
            cancelButton.appendChild(document.createTextNode("Cancel"));

            const dialog = new Dialog({
                title: "Create Folder",
                elements: [
                    folderName,
                    [createButton, cancelButton]
                ]
            });

            createButton.addEventListener("click", async () => {
                await ApiRequest("/files/mkdir", {
                    name: folderName.value,
                    path: this.path,
                });
                await this.load(this.path);
                dialog.close();
            });

            cancelButton.addEventListener("click", () => {
                dialog.close();
            });
        });

        this.path = "/";
    }

    refresh() {
        this.load(this.path);
    }

    async load(path) {
        this.files.innerHTML = "";

        const response = await ApiRequest("/files/list", { path });
        if (response.status != "success") {
            this.files.className = "files-error";
            this.files.appendChild(document.createTextNode(`Error: Failed to load files at '${path}'`));
            return;
        }
        this.path = response.path;

        this.titleNode.textContent = `Files - ${response.path}`;
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
    }

    addFolder(img, name, path) {
        const icon = document.createElement("i");
        icon.classList = `fa-solid fa-${img}`;

        const item = this.files.appendChild(document.createElement("div"));
        item.className = "item directory";

        const nameElement = item.appendChild(document.createElement("div"));
        nameElement.className = "name";
        nameElement.appendChild(icon);
        nameElement.appendChild(document.createTextNode(name));

        if (name != "..") {
            const deleteButton = item.appendChild(Button("trash"));
            deleteButton.addEventListener("click", async () => {
                if (!(await ConfirmDialog(`Are you sure you want to delete ${path}?`))) {
                    return;
                }
                await ApiRequest("/files/delete", { path });
                this.load(this.path);
            });
        }

        nameElement.addEventListener("click", () => {
            this.load(path);
        });
    }

    async addFile(filetype, img, name, path) {
        let url_path = null;
        if (Session.gm) {
            url_path = `/files${path}`;
        }
        else {
            url_path = `/files/${Session.username}${path}`;
        }

        let icon;
        if (filetype.startsWith("image/")) {
            const encoder = new TextEncoder();
            let thumbnail = "/thumbnails/";
            for (let byte of new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(url_path)))) {
                thumbnail += byte.toString(16).padStart(2, '0');
            }
            thumbnail += ".png";
            icon = document.createElement("img");
            icon.classList = "tiny thumbnail";
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

        AddDragListener(nameElement, { type: "file", filetype, path: url_path });

        const deleteButton = item.appendChild(Button("trash"));
        deleteButton.addEventListener("click", async () => {
            if (!(await ConfirmDialog(`Are you sure you want to delete ${name}?`))) {
                return;
            }
            await ApiRequest("/files/delete", { path });
            this.load(this.path);
        });

        nameElement.addEventListener("click", () => {
            window.open(url_path, path);
        });
    }
}
