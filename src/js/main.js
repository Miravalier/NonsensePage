import * as ContextMenu from "./contextmenu.js";
import * as Database from "./database.js";
import { Vector2 } from "./vector.js";
import { CombatTrackerWindow } from "./combat_tracker_window.js";
import { ChatWindow } from "./chat_window.js";
import { FileWindow } from "./file_window.js";
import { ApiRequest, Session, WsConnect } from "./requests.js";
import { CharacterListWindow } from "./character_list_window.js";
import { CheckUpdates } from "./pending_updates.js";
import { Roll } from "./dice.js";
import { MapListWindow } from "./map_list_window.js";
import { windows } from "./window.js";


window.addEventListener("load", async () => {
    await OnLoad();
    await Main();
});


async function OnLoad() {
    window.Session = Session;
    window.Database = Database;
    window.ApiRequest = ApiRequest;
    window.Roll = Roll;

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
    Session.id = response.id;
    const chatWindow = new ChatWindow({
        size: new Vector2(400, window.innerHeight),
        position: new Vector2(window.innerWidth-400, 0),
    });
    await chatWindow.load();
}


async function Main() {
    await WsConnect();
    setInterval(() => {
        Session.ws.send(JSON.stringify({ type: "heartbeat" }));
    }, 5000);
    setInterval(CheckUpdates, 1000);

    await Database.init();
    await ContextMenu.init();

    ContextMenu.set(document, {
        "Open": {
            "Characters": async (ev) => {
                const characterListWindow = new CharacterListWindow({
                    position: new Vector2(ev.clientX, ev.clientY),
                });
                await characterListWindow.load();
            },
            "Chat": async (ev) => {
                const chatWindow = new ChatWindow({
                    position: new Vector2(ev.clientX, ev.clientY),
                });
                await chatWindow.load();
            },
            "Combat Tracker": async (ev) => {
                const combatTrackerWindow = new CombatTrackerWindow({
                    position: new Vector2(ev.clientX, ev.clientY),
                });
                await combatTrackerWindow.load();
            },
            "Files": async (ev) => {
                const fileWindow = new FileWindow({
                    position: new Vector2(ev.clientX, ev.clientY),
                });
                await fileWindow.load("/");
            },
            "Maps": async (ev) => {
                const mapListWindow = new MapListWindow({
                    position: new Vector2(ev.clientX, ev.clientY),
                });
                await mapListWindow.load();
            },
        },
        "Layout": {
            "Save": async (ev) => {
                const selection = await InputDialog("Save Layout", { "Name": "text" }, "Create");
                if (!selection || !selection.Name) {
                    return;
                }
            },
            "Load": async (ev) => {
                // TODO: add check / error msg if no saves
                // TODO: auto load format if only one is saved
                const loadFormatWindow = new LoadFormatWindow({
                    title: "Choose Format",
                    position: new Vector2(ev.clientX, ev.clientY),
                });
                await loadFormatWindow.load();
            },
        },
    });
}
