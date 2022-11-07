import { ContentWindow, ConfirmDialog, Dialog } from "./window.js";
import { ApiRequest, Session, FileUpload } from "./requests.js";
import { Vector2 } from "./vector.js";
import { Button } from "./elements.js";
import { Parameter } from "./utils.js";


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
            const filePicker = document.createElement("input");
            filePicker.type = "file";

            const uploadButton = document.createElement("button");
            uploadButton.appendChild(document.createTextNode("Upload"));

            const cancelButton = document.createElement("button");
            cancelButton.appendChild(document.createTextNode("Cancel"));

            const dialog = new Dialog({
                name: "Upload File",
                elements: [
                    filePicker,
                    [uploadButton, cancelButton]
                ]
            });

            uploadButton.addEventListener("click", async () => {
                for (let file of filePicker.files) {
                    await FileUpload(file, this.path);
                }
                await this.load(this.path);
                dialog.close();
            });

            cancelButton.addEventListener("click", () => {
                dialog.close();
            });
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
                name: "Create Folder",
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
                this.addFile(img, name, path);
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

    addFile(img, name, path) {
        const icon = document.createElement("i");
        icon.classList = `fa-solid fa-${img}`;

        const item = this.files.appendChild(document.createElement("div"));
        item.className = "item file";

        const nameElement = item.appendChild(document.createElement("div"));
        nameElement.className = "name";
        nameElement.appendChild(icon);
        nameElement.appendChild(document.createTextNode(name));

        const deleteButton = item.appendChild(Button("trash"));
        deleteButton.addEventListener("click", async () => {
            if (!(await ConfirmDialog(`Are you sure you want to delete ${name}?`))) {
                return;
            }
            await ApiRequest("/files/delete", { path });
            this.load(this.path);
        });

        nameElement.addEventListener("click", () => {
            if (Session.gm) {
                window.open(`/files${path}`, path);
            }
            else {
                window.open(`/files/${Session.username}${path}`, path);
            }
        });
    }
}
