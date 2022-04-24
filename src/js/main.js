import { Vector2 } from "./vector.js";
import { CanvasWindow, ContentWindow } from "./window.js";
import { ContextMenu } from "./contextmenu.js";
import { LoremIpsum } from "./utils.js";
import { ApiRequest, RequestSession } from "./requests.js"


$(async () => {
    window.LogOut = () => {
        localStorage.removeItem("token");
        RequestSession.token = null;
        console.log("Logged out, redirecting to /login");
        window.location.href = "/login";
    };

    RequestSession.token = localStorage.getItem("token");
    if (!RequestSession.token) {
        console.error("No token found in local storage, redirecting to /login");
        window.location.href = "/login";
    }

    const response = await ApiRequest("/status");
    console.log("Auth Status", response);

    if (response.status !== "success") {
        console.error(response.reason);
        window.location.href = "/login";
    }

    Main();
});


function Main() {
    let contextMenu = null;
    document.addEventListener("click", () => {
        if (contextMenu !== null) {
            contextMenu.remove();
        }
    });
    document.addEventListener("contextmenu", ev => {
        ev.preventDefault();

        if (contextMenu !== null) {
            contextMenu.remove();
        }

        contextMenu = new ContextMenu({
            position: new Vector2(ev.clientX, ev.clientY),
            title: "Create Window",
            choices: {
                "Lorem Ipsum": async () => {
                    const contentWindow = new ContentWindow({
                        title: "Lorem Ipsum",
                        position: new Vector2(ev.clientX, ev.clientY),
                    });
                    contentWindow.content.appendChild(document.createTextNode(LoremIpsum()));
                },
                "Circle": async () => {
                    const canvasWindow = new CanvasWindow({ title: "Circle" });
                    canvasWindow.canvas.DrawCircle({
                        position: new Vector2(60, 60),
                        radius: 50,
                        fillColor: 0x000000,
                    });
                },
            },
        });
    });
}
