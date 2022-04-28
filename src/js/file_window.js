import { ContentWindow } from "./window.js";
import { ApiRequest, Session } from "./requests.js";


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
        super(options);
        this.files = this.content.appendChild(document.createElement("div"));
        this.files.className = "files";
    }

    async load(path) {
        this.files.remove();
        this.files = this.content.appendChild(document.createElement("div"));
        this.files.className = "files";

        const response = await ApiRequest("/files/list", { path });
        if (response.status != "success") {
            this.files.className = "files-error";
            this.files.appendChild(document.createTextNode(`Error: Failed to load files at '${path}'`));
            return;
        }

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

        const element = this.files.appendChild(document.createElement("div"));
        element.className = "item directory";
        element.appendChild(icon);
        element.appendChild(document.createTextNode(name));

        element.addEventListener("click", () => {
            this.load(path);
        })
    }

    addFile(img, name, path) {
        const icon = document.createElement("i");
        icon.classList = `fa-solid fa-${img}`;

        const element = this.files.appendChild(document.createElement("div"));
        element.className = "item file";
        element.appendChild(icon);
        element.appendChild(document.createTextNode(name));

        element.addEventListener("click", () => {
            if (Session.gm) {
                window.open(`/files${path}`, path);
            }
            else {
                window.open(`/files/${Session.username}${path}`, path);
            }
        });
    }
}
