import { ContentWindow, registerWindowType } from "./Window.ts";
import { Vector2 } from "../lib/Vector.ts";
import { IsDefined, Parameter } from "../lib/Utils.ts";


export class FileViewer extends ContentWindow {
    iframe: HTMLIFrameElement;
    path: string;

    constructor(options = undefined) {
        options = Parameter(options, {});
        options.classList = ["file-viewer"];
        options.size = Parameter(options.size, new Vector2(540, 600));
        super(options);
        this.path = null;
        this.iframe = null;
    }

    onResizeStart() {
        this.iframe.classList.add("disabled");
    }

    onResizeStop() {
        this.iframe.classList.remove("disabled");
    }

    async load(path: string = undefined) {
        await super.load();
        this.content.innerHTML = "";
        if (IsDefined(path)) {
            this.path = path;
        }

        this.setTitle(this.path);

        const cssLink = document.createElement("link");
        cssLink.href = "/Embed.css";
        cssLink.rel = "stylesheet";
        cssLink.type = "text/css";

        this.iframe = document.createElement("iframe");
        this.iframe.src = this.path;
        this.iframe.addEventListener("load", () => {
            this.iframe.contentDocument.head.appendChild(cssLink);
        });
        this.content.appendChild(this.iframe);
    }

    serialize() {
        return { path: this.path };
    }

    async deserialize(data) {
        await this.load(data.path);
    }
}
registerWindowType(FileViewer);
