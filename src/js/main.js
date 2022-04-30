import { Vector2 } from "./vector.js";
import { CanvasWindow } from "./window.js";
import { ChatWindow } from "./chat_window.js";
import { FileWindow } from "./file_window.js";
import { ContextMenu } from "./contextmenu.js";
import { ApiRequest, Session, WsConnect } from "./requests.js";
import { CharacterWindow } from "./character_window.js";


$(async () => {
    window.Session = Session;
    window.ApiRequest = ApiRequest;

    window.LogOut = () => {
        localStorage.removeItem("token");
        Session.token = null;
        console.log("Logged out, redirecting to /login");
        window.location.href = "/login";
    };

    Session.token = localStorage.getItem("token");
    if (!Session.token) {
        console.error("No token found in local storage, redirecting to /login");
        window.location.href = "/login";
    }

    const response = await ApiRequest("/status");
    console.log("Auth Status", response);

    if (response.status !== "success") {
        console.error(response.reason);
        window.location.href = "/login";
    }

    Session.gm = response.gm;
    Session.username = response.username;

    Main();
});


async function Main() {
    await WsConnect();
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
                "Chat": async () => {
                    const chatWindow = new ChatWindow({
                        title: "Char",
                        position: new Vector2(ev.clientX, ev.clientY),
                    });
                    await chatWindow.loadMessages();
                },
                "File Browser": async () => {
                    const fileWindow = new FileWindow({
                        title: "Files",
                        position: new Vector2(ev.clientX, ev.clientY),
                    });
                    await fileWindow.load("/");
                },
                "Character Sheet": async () => {
                    const characterWindow = new CharacterWindow({
                        title: "Character Sheet",
                        position: new Vector2(ev.clientX, ev.clientY),
                    });
                    await characterWindow.load();
                },
                "Circle": async () => {
                    const canvasWindow = new CanvasWindow({
                        title: "Circle",
                        position: new Vector2(ev.clientX, ev.clientY),
                    });
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
