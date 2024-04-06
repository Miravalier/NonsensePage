import * as ContextMenu from "../lib/contextmenu.ts";
import * as Database from "../lib/database.ts";
import * as Notifications from "../lib/notifications.ts";
import * as Templates from "../lib/templates.ts";
import { Vector2 } from "../lib/vector.ts";
import { CombatTrackerWindow } from "../windows/combat_tracker_window.ts";
import { ChatWindow } from "../windows/chat_window.ts";
import { FileWindow } from "../windows/file_window.ts";
import { ApiRequest, Session, Subscribe, WsConnect } from "../lib/requests.ts";
import { CharacterListWindow } from "../windows/character_list_window.ts";
import { CheckUpdates } from "../lib/pending_updates.ts";
import { MapListWindow } from "../windows/map_list_window.ts";
import {
    launchWindow, windows, InputDialog,
    applyLayout, SerializedWindow,
} from "../windows/window.ts";
import { ErrorToast } from "../lib/notifications.ts";
import * as Sheets from "../sheets";


window.addEventListener("load", async () => {
    await OnLoad();
    await Main();
});


export function LogOut() {
    localStorage.removeItem("token");
    Session.token = null as any;
    console.log("Logged out, redirecting to /login");
    window.location.href = "/login";
}


async function OnLoad() {
    const token = localStorage.getItem("token");
    if (token === null) {
        console.error("No token found in local storage, redirecting to /login");
        window.location.href = "/login";
        return;
    }
    Session.token = token;

    const response = await ApiRequest("/status");
    if (response.status !== "success") {
        console.error(response.reason);
        window.location.href = "/login";
    }

    Session.gm = response.gm;
    Session.username = response.username;
    Session.id = response.id;
}


function PreloadRuleset(ruleset: string) {
    const { html, css } = Sheets.SheetResources[ruleset + "Sheet"];
    Templates.loadCss(ruleset + "Sheet", css);
    Templates.loadTemplate(ruleset + "Sheet", html);
}


async function Main() {
    await WsConnect();
    setInterval(() => {
        Session.ws.send(JSON.stringify({ type: "heartbeat" }));
    }, 5000);
    setInterval(CheckUpdates, 1000);

    await Database.init();
    await ContextMenu.init();
    await Notifications.init();
    await Templates.init();

    PreloadRuleset("Generic");
    PreloadRuleset("Lightbearer");

    Subscribe("show/window", (data: { user: string; type: string; data: any; }) => {
        if (Session.id == data.user) {
            return;
        }
        launchWindow(data.type, data.data);
    });

    const contextOptions = {
        "Open": {
            "Characters": async (ev: MouseEvent) => {
                const characterListWindow = new CharacterListWindow({
                    position: new Vector2(ev.clientX, ev.clientY),
                });
                await characterListWindow.load();
            },
            "Chat": async (ev: MouseEvent) => {
                const chatWindow = new ChatWindow({
                    position: new Vector2(ev.clientX, ev.clientY),
                });
                await chatWindow.load();
            },
            "Combat Tracker": async (ev: MouseEvent) => {
                const combatTrackerWindow = new CombatTrackerWindow({
                    position: new Vector2(ev.clientX, ev.clientY),
                });
                await combatTrackerWindow.load();
            },
            "Files": async (ev: MouseEvent) => {
                const fileWindow = new FileWindow({
                    position: new Vector2(ev.clientX, ev.clientY),
                });
                await fileWindow.load("/");
            },
            "Maps": async (ev: MouseEvent) => {
                const mapListWindow = new MapListWindow({
                    position: new Vector2(ev.clientX, ev.clientY),
                });
                await mapListWindow.load();
            },
        },
        "Layout": {
            "Save": async () => {
                const selection = await InputDialog("Save Layout", { "Name": "text", "Default": "checkbox" }, "Create");
                if (!selection || !selection.Name) {
                    return;
                }

                const layout: SerializedWindow[] = [];
                for (const openWindow of Object.values(windows)) {
                    const serializedWindow: SerializedWindow = {
                        type: openWindow.constructor.name,
                        data: openWindow.serialize(),
                        left: openWindow.position.x / window.innerWidth,
                        right: (window.innerWidth - openWindow.position.x - openWindow.size.x) / window.innerWidth,
                        top: openWindow.position.y / window.innerHeight,
                        bottom: (window.innerHeight - openWindow.position.y - openWindow.size.y) / window.innerHeight,
                    };
                    layout.push(serializedWindow);
                }

                if (selection.Default) {
                    window.localStorage.setItem("defaultLayout", selection.Name);
                }
                let layouts = JSON.parse(window.localStorage.getItem("layouts"));
                if (layouts === null) {
                    layouts = {};
                }
                layouts[selection.Name] = layout;
                window.localStorage.setItem("layouts", JSON.stringify(layouts));
            },
            "Load": async () => {
                const layouts = JSON.parse(window.localStorage.getItem("layouts"));
                if (layouts === null || Object.keys(layouts).length == 0) {
                    ErrorToast(`No layouts saved.`);
                    return;
                }
                const selection = await InputDialog("Load Layout", { "Name": ["select", Object.keys(layouts)] }, "Load");
                if (selection == null) {
                    return;
                }
                const selectedLayout = layouts[selection.Name];

                for (const openWindow of Object.values(windows)) {
                    openWindow.close();
                }

                await applyLayout(selectedLayout);
            },
            "Delete": async () => {
                const layouts = JSON.parse(window.localStorage.getItem("layouts"));
                if (null == layouts || Object.keys(layouts).length == 0) {
                    ErrorToast(`No layouts saved.`);
                    return;
                }
                const selection = await InputDialog("Delete Layout", { "Name": ["select", Object.keys(layouts)] }, "Delete");
                if (selection == null) {
                    return;
                }
                const selectionName = selection.Name;
                delete layouts[selectionName];
                if (window.localStorage.getItem("defaultLayout") == selectionName) {
                    window.localStorage.removeItem("defaultLayout");
                }
                window.localStorage.setItem("layouts", JSON.stringify(layouts));
            },
        },
        "Settings": {
            "Log Out": () => {
                localStorage.removeItem("token");
                location.reload();
            }
        }
    };

    if (Session.gm) {
        contextOptions["Settings"]["Create User"] = async () => {
            const selection = await InputDialog("Create User", {
                "Username": "text",
                "Password": "text",
            }, "Create");
            await ApiRequest(
                "/user/create",
                {
                    username: selection.Username,
                    password: selection.Password,
                }
            );
        }
    }

    ContextMenu.set(document.body, contextOptions);

    const defaultLayout = window.localStorage.getItem("defaultLayout");
    if (defaultLayout != null) {
        const layouts = JSON.parse(window.localStorage.getItem("layouts"));
        await applyLayout(layouts[defaultLayout]);
    }
    else {
        const chatWindow = new ChatWindow({
            size: new Vector2(400, window.innerHeight - 64),
            position: new Vector2(window.innerWidth - 400, 0),
        });
        await chatWindow.load();
    }
}
