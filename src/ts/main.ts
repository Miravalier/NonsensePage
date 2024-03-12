import * as ContextMenu from "./contextmenu.js";
import * as Database from "./database.js";
import { Vector2 } from "./vector.js";
import { CombatTrackerWindow } from "./combat_tracker_window.js";
import { ChatWindow } from "./chat_window.js";
import { FileWindow } from "./file_window.js";
import { ApiRequest, Session, WsConnect } from "./requests.js";
import { CharacterListWindow } from "./character_list_window.js";
import { CheckUpdates } from "./pending_updates.js";
import { MapListWindow } from "./map_list_window.js";
import { windows, InputDialog, loadFormat } from "./window.js";
import { ErrorToast } from "./notifications.js";


window.addEventListener("load", async () => {
    await OnLoad();
    await Main();
});


export function LogOut() {
    localStorage.removeItem("token");
    Session.token = null;
    console.log("Logged out, redirecting to /login");
    window.location.href = "/login";
}


async function OnLoad() {
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
}


async function Main() {
    await WsConnect();
    setInterval(() => {
        Session.ws.send(JSON.stringify({ type: "heartbeat" }));
    }, 5000);
    setInterval(CheckUpdates, 1000);

    await Database.init();
    await ContextMenu.init();

    ContextMenu.set(document.body, {
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
                const selection = await InputDialog("Save Layout", { "Name": "text", "Default": "checkbox" }, "Create");
                if (!selection || !selection.Name) {
                    return;
                }

                const windowArray = [];
                for (const openWindow of Object.values(windows)) {
                    const windowMap = {
                        type: openWindow.constructor.name,
                        data: openWindow.serialize(),
                        left: openWindow.position.x / window.innerWidth,
                        right: (window.innerWidth - openWindow.position.x - openWindow.size.x) / window.innerWidth,
                        top: openWindow.position.y / window.innerHeight,
                        bottom: (window.innerHeight - openWindow.position.y - openWindow.size.y) / window.innerHeight,
                    };
                    windowArray.push(windowMap);
                }

                if (selection.Default) {
                    window.localStorage.setItem("defaultFormat", selection.Name);
                }
                let allFormatsString = window.localStorage.getItem("formats");
                if (allFormatsString == null) {
                    allFormatsString = "{}";
                }
                let allFormatsMap = JSON.parse(allFormatsString);
                allFormatsMap[selection.Name] = windowArray;
                allFormatsString = JSON.stringify(allFormatsMap);
                window.localStorage.setItem("formats", allFormatsString);
            },
            "Load": async (ev) => {
                const allFormatsString = window.localStorage.getItem("formats");
                if (null == allFormatsString) {
                    ErrorToast(`No formats saved.`);
                    return;
                }
                const allFormatsMap = JSON.parse(allFormatsString);
                const selection = await InputDialog("Load Format", { "Name": ["select", Object.keys(allFormatsMap)] }, "Load");
                if (selection == null) {
                    return;
                }
                const selectedFormat = allFormatsMap[selection.Name];

                for (const openWindow of Object.values(windows)) {
                    openWindow.close();
                }

                await loadFormat(selectedFormat);

            },
            "Delete": async (ev) => {
                let allFormatsString = window.localStorage.getItem("formats");
                if (null == allFormatsString) {
                    ErrorToast(`No formats saved.`);
                    return;
                }
                const allFormatsMap = JSON.parse(allFormatsString);
                const selection = await InputDialog("Delete Format", { "Name": ["select", Object.keys(allFormatsMap)] }, "Delete");
                if (selection == null) {
                    return;
                }
                const selectionName = selection.Name;
                delete allFormatsMap[selectionName];
                if (window.localStorage.getItem("defaultFormat") == selectionName) {
                    window.localStorage.removeItem("defaultFormat");
                }
                allFormatsString = JSON.stringify(allFormatsMap);
                window.localStorage.setItem("formats", allFormatsString);
            },
        },
    });
    const defaultFormatName = window.localStorage.getItem("defaultFormat");
    const allFormatsString = window.localStorage.getItem("formats");
    if ((defaultFormatName != null) && (allFormatsString != null)) {
        const allFormatsMap = JSON.parse(allFormatsString);
        const defaultFormat = allFormatsMap[defaultFormatName];
        await loadFormat(defaultFormat);
    }
    else {
        const chatWindow = new ChatWindow({
            size: new Vector2(400, window.innerHeight), // Might want 90% height
            position: new Vector2(window.innerWidth - 400, 0),
        });
        await chatWindow.load();
    }
}
