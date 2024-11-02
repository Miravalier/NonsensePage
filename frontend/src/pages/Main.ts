import * as ContextMenu from "../lib/ContextMenu.ts";
import * as Database from "../lib/Database.ts";
import * as Notifications from "../lib/Notifications.ts";
import * as Templates from "../lib/Templates.ts";
import { users } from "../lib/Database.ts";
import { ErrorToast } from "../lib/Notifications.ts";
import { IntroRegistry } from "../lib/Intro.ts";
import { Rulesets } from "../rulesets/index.ts";
import { Vector2 } from "../lib/Vector.ts";
import { LogOut } from "../lib/Utils.ts";
import { CombatTrackerWindow } from "../windows/CombatTracker.ts";
import { ChatWindow } from "../windows/ChatWindow.ts";
import { FileWindow } from "../windows/FileWindow.ts";
import { ApiRequest, Session, Subscribe, WsConnect } from "../lib/Requests.ts";
import { CharacterListWindow } from "../windows/CharacterList.ts";
import { MapListWindow } from "../windows/MapList.ts";
import { CharacterCreatorWindow } from "../windows/CharacterCreator.ts";
import { CharacterSheetWindow } from "../windows/CharacterSheet.ts";
import {
    launchWindow, windows, InputDialog,
    applyLayout, SerializedWindow,
} from "../windows/Window.ts";
import { NoteListWindow } from "../windows/NoteList.ts";
import { AbilityListWindow } from "../windows/AbilityList.ts";
import { SettingsWindow } from "../windows/SettingsWindow.ts";
import { PresenceWindow } from "../windows/Presence.ts";
import { ClearSelectedTokens, GetSelectedTokens } from "../lib/Canvas.ts";
import { FederatedEvent, spritesheetAsset } from "pixi.js";


declare global {
    interface Window {
        Nonsense: any;
    }
}


window.addEventListener("load", async () => {
    try {
        await OnLoad();

        const searchParams = new URLSearchParams(location.search);
        const windowString = searchParams.get("window");
        if (windowString) {
            const serializedWindow = JSON.parse(atob(windowString));
            launchWindow(serializedWindow.type, serializedWindow.data, true);
        }
        else {
            await Main();
        }
    }
    catch (error) {
        console.error(error);
        document.body.innerHTML = '<div class="watermark">Failed to connect to the server. Wait a while and refresh the page.</div>';
    }
});


async function OnLoad() {
    await Notifications.init();

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

    Session.gm = response.user.is_gm;
    Session.id = response.user.id;
    Session.username = response.user.name;

    // Re-auth now and every 15 minutes
    ApiRequest("/re-auth");
    setInterval(ApiRequest, 900000, "/re-auth");

    for (const ruleset of Rulesets) {
        await ruleset.init();
    }

    // Add functions to the window
    window.Nonsense = {
        Database,
        Session,
        ApiRequest,
        LogOut,
        Warning: Notifications.WarningToast,
        Error: Notifications.ErrorToast,
        Info: Notifications.InfoToast,
        CreateCharacter: async () => {
            const characterCreator = new CharacterCreatorWindow();
            await characterCreator.load();
        },
        GetSelectedTokens,
    };

    await WsConnect();
    setInterval(() => {
        if (Session.ws.readyState == WebSocket.OPEN) {
            Session.ws.send(JSON.stringify({ type: "heartbeat" }));
        }
    }, 5000);

    await Database.init();
    await ContextMenu.init();
    await Templates.init();
}


async function Main() {
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
            "Notes": async (ev: MouseEvent) => {
                const noteListWindow = new NoteListWindow({
                    position: new Vector2(ev.clientX, ev.clientY),
                });
                await noteListWindow.load();
            },
            "Abilities": async (ev: MouseEvent) => {
                const abilityListWindow = new AbilityListWindow({
                    position: new Vector2(ev.clientX, ev.clientY),
                });
                await abilityListWindow.load();
            },
            "Settings": async (ev: MouseEvent) => {
                const settingsWindow = new SettingsWindow({
                    position: new Vector2(ev.clientX, ev.clientY),
                });
                await settingsWindow.load();
            },
            "Presence": async (ev: MouseEvent) => {
                const presenceWindow = new PresenceWindow({
                    position: new Vector2(ev.clientX, ev.clientY),
                });
                await presenceWindow.load();
            }
        },
        "Layout": {
            "Save": async () => {
                const selection = await InputDialog("Save Layout", { "Name": "text", "Default": "checkbox" }, "Create");
                if (!selection) {
                    return;
                }
                if (selection.Default) {
                    selection.Name = "Default";
                }
                if (!selection.Name) {
                    ErrorToast("Missing layout name.");
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
            "Refresh": () => {
                // @ts-ignore
                location.reload(true);
            },
        },
    };

    ContextMenu.set(document.body, contextOptions);

    const windowsContainer = document.querySelector("#windows") as HTMLDivElement;
    windowsContainer.addEventListener("dblclick", async (ev) => {
        if (windowsContainer != ev.target) {
            return;
        }

        if (!users[Session.id].character_id) {
            return;
        }

        const characterSheetWindow = new CharacterSheetWindow({
            title: "Character Sheet",
        });
        await characterSheetWindow.load(users[Session.id].character_id);
    });

    document.addEventListener("keydown", (ev) => {
        if (ev.key == "Escape") {
            ClearSelectedTokens();
        }
        if (ev.key == "Delete") {
            for (const token of GetSelectedTokens()) {
                token.emit("delete");
            }
        }
    });

    LoadStartingWindows();
}

async function LoadStartingWindows() {
    if (!Session.gm && !users[Session.id].character_id && IntroRegistry.html !== null) {
        const characterCreator = new CharacterCreatorWindow({
            size: new Vector2(window.innerWidth - 40, window.innerHeight - 80),
            position: new Vector2(20, 20),
        });
        await characterCreator.load();
        characterCreator.on_close.push(LoadStartingWindows);
    }
    else {
        const defaultLayout = localStorage.getItem("defaultLayout");
        if (defaultLayout != null) {
            const layouts = JSON.parse(localStorage.getItem("layouts"));
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
}
