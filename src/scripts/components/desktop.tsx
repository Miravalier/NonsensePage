import * as React from "react";

import { ContextMenu, ContextMenuOption } from "./context-menu";
import { FilesWindow } from "./files-window";
import { ChatWindow } from "./chat-window";
import { setStylePosition } from "../positioning";
import { randomID } from "../utilities";

interface DesktopProps { }

interface DesktopState {
    windows: Record<string, React.ReactElement>;
}

export class Desktop extends React.Component<DesktopProps, DesktopState> {
    contextMenuRef: React.RefObject<ContextMenu>;
    contextResolve: (value?: any | PromiseLike<any>) => void;

    constructor(props: DesktopProps) {
        super(props);
        this.contextMenuRef = React.createRef();
        this.state = { windows: {} };

        window.desktop = this;
    }

    render() {
        return (
            <div
                id="desktop"
                onContextMenu={(ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    this.newWindow(ev);
                }}
                onClick={(ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    this.closeContextMenu(ev);
                }}
            >
                <h1>Canonfire</h1>
                <img className="logo" src="Canonfire.webp"></img>
                <div id="windows">
                    {Object.values(this.state.windows)}
                </div>
                <ContextMenu ref={this.contextMenuRef} />
            </div>
        );
    }

    closeContextMenu(ev: React.MouseEvent) {
        if (this.contextResolve) {
            this.contextResolve(null);
        }
    }

    async openContextMenu(ev: React.MouseEvent, title: string, options: ContextMenuOption[]): Promise<string> {
        const contextMenu = this.contextMenuRef.current;
        const style: React.CSSProperties = {
            display: null,
        };
        setStylePosition(style, ev);
        const id = await new Promise<string>(resolve => {
            /* Prepare shortcut map for keypress interaction */
            const shortcutMap = {};
            for (let option of options) {
                if (!option.shortcut) continue;
                shortcutMap[option.shortcut] = option.id;
            }
            this.contextResolve = (keypress?: string) => {
                if (!keypress) {
                    resolve(null);
                    return;
                }
                if (!keypress.startsWith("Key") &&
                    !keypress.startsWith("Numpad") &&
                    !keypress.startsWith("Digit")) {
                    return;
                }
                const shortcut = keypress[keypress.length - 1];
                resolve(shortcutMap[shortcut]);
            }
            /* Reveal context menu for mouse interaction */
            contextMenu.setState({
                title,
                style,
                options,
                callback: resolve
            });
        });
        contextMenu.setState({
            style: { display: "none" },
            callback: null,
        });
        this.contextResolve = null;
        return id;
    }

    closeWindow(windowId: string) {
        const windows = this.state.windows;
        delete windows[windowId];
        this.setState({ windows });
    }

    async newWindow(ev: React.MouseEvent) {
        // Figure out which window to create
        const id = await this.openContextMenu(ev, "New Window", [
            { id: "chat", title: "Chat", shortcut: "C" },
            { id: "files", title: "Files", shortcut: "F" },
        ]);
        if (!id) return;
        // Create new window
        const windows = this.state.windows;
        const windowId = randomID();
        if (id == "chat") {
            windows[windowId] = <ChatWindow key={windowId} id={windowId}
                onClose={(windowId) => this.closeWindow(windowId)}
                left={ev.clientX} top={ev.clientY} />;
        }
        else if (id == "files") {
            windows[windowId] = <FilesWindow key={windowId} id={windowId}
                onClose={(windowId) => this.closeWindow(windowId)}
                left={ev.clientX} top={ev.clientY} />;
        }
        this.setState({ windows });
    }
}
