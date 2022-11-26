import { Vector2 } from "./vector.js";
import { CombatTrackerWindow } from "./combat_tracker_window.js";
import { ChatWindow } from "./chat_window.js";
import { FileWindow } from "./file_window.js";
import { ContextMenu } from "./contextmenu.js";
import { ApiRequest, Session, WsConnect } from "./requests.js";
import { CharacterListWindow } from "./character_list_window.js";
import { CheckUpdates } from "./pending_updates.js";


window.addEventListener("load", async () => {
    await OnLoad();
    await Main();
});


async function OnLoad() {
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
}


async function Main() {
    await WsConnect();
    setInterval(() => {
        Session.ws.send(JSON.stringify({ type: "heartbeat" }));
    }, 5000);
    setInterval(CheckUpdates, 1000);

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
                "Characters": async () => {
                    const characterListWindow = new CharacterListWindow({
                        title: "Characters",
                        position: new Vector2(ev.clientX, ev.clientY),
                    });
                    await characterListWindow.load();
                },
                "Chat": async () => {
                    const chatWindow = new ChatWindow({
                        title: "Chat",
                        position: new Vector2(ev.clientX, ev.clientY),
                    });
                    await chatWindow.loadMessages();
                },
                "Combat Tracker": async () => {
                    const combatTrackerWindow = new CombatTrackerWindow({
                        title: "Combat Tracker",
                        position: new Vector2(ev.clientX, ev.clientY),
                    });
                    await combatTrackerWindow.load();
                },
                "Files": async () => {
                    const fileWindow = new FileWindow({
                        title: "Files",
                        position: new Vector2(ev.clientX, ev.clientY),
                    });
                    await fileWindow.load("/");
                },
            },
        });
    });
}
