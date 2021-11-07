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
        const contextMenu = this.contextMenuRef.current;
        if (contextMenu.state.callback) {
            contextMenu.state.callback(null);
        }
        contextMenu.setState({
            style: {
                display: "none",
            },
            callback: null,
        });
    }

    async openContextMenu(ev: React.MouseEvent, options: ContextMenuOption[]): Promise<string> {
        const style: React.CSSProperties = {
            display: null,
        };
        setStylePosition(style, ev);
        return new Promise<string>(resolve => {
            this.contextMenuRef.current.setState({
                style,
                options,
                callback: resolve
            });
        });
    }

    closeWindow(windowId: string) {
        const windows = this.state.windows;
        delete windows[windowId];
        this.setState({ windows });
    }

    async newWindow(ev: React.MouseEvent) {
        // Figure out which window to create
        const id = await this.openContextMenu(ev, [
            { id: "chat", title: "New Chat Window" },
            { id: "files", title: "New Files Window" },
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
