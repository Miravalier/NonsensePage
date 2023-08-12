import * as ContextMenu from "./contextmenu.js";
import { Vector2 } from "./vector.js";
import { CombatTrackerWindow } from "./combat_tracker_window.js";
import { ChatWindow } from "./chat_window.js";
import { FileWindow } from "./file_window.js";
import { ApiRequest, Session, WsConnect } from "./requests.js";
import { CharacterListWindow } from "./character_list_window.js";
import { CheckUpdates } from "./pending_updates.js";
import { Html } from "./elements.js";
import { GenerateId } from "./utils.js";


window.addEventListener("load", async () => {
    await OnLoad();
    await Main();
});


async function OnLoad() {
    window.Session = Session;
    window.ApiRequest = ApiRequest;
    window.Html = Html;
    window.GenerateId = GenerateId;

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

    ContextMenu.init();

    ContextMenu.set(document, {
        "Create Window": {
            "Characters": async (ev) => {
                const characterListWindow = new CharacterListWindow({
                    title: "Characters",
                    position: new Vector2(ev.clientX, ev.clientY),
                });
                await characterListWindow.load();
            },
            "Chat": async (ev) => {
                const chatWindow = new ChatWindow({
                    title: "Chat",
                    position: new Vector2(ev.clientX, ev.clientY),
                });
                await chatWindow.load();
            },
            "Combat Tracker": async (ev) => {
                const combatTrackerWindow = new CombatTrackerWindow({
                    title: "Combat Tracker",
                    position: new Vector2(ev.clientX, ev.clientY),
                });
                await combatTrackerWindow.load();
            },
            "Files": async (ev) => {
                const fileWindow = new FileWindow({
                    title: "Files",
                    position: new Vector2(ev.clientX, ev.clientY),
                });
                await fileWindow.load("/");
            },
        },
    });
}
