import * as React from "react";

import { ContextMenu, ContextMenuOption } from "./context-menu";
import { FilesWindow } from "./files-window";
import { ChatWindow } from "./chat-window";
import { setStylePosition } from "../positioning";
import { randomID } from "../utilities";

interface DesktopProps { }

interface DesktopState {
    windows: React.ReactElement[];
}

export class Desktop extends React.Component<DesktopProps, DesktopState> {
    contextMenuRef: React.RefObject<ContextMenu>;

    constructor(props: DesktopProps) {
        super(props);
        this.contextMenuRef = React.createRef();
        this.state = { windows: [] };

        window.desktop = this;
    }

    render() {
        return (
            <div
                id="desktop"
                onContextMenu={(ev) => this.newWindowMenu(ev)}
                onClick={(ev) => {
                    ev.stopPropagation();
                    this.closeContextMenu(ev);
                }}
            >
                <ContextMenu ref={this.contextMenuRef} />
                <div className="windows">
                    {this.state.windows}
                </div>
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
        const x = this;
        console.log(x);
        return new Promise<string>(resolve => {
            this.contextMenuRef.current.setState({
                style,
                options,
                callback: resolve
            });
        });
    }

    async newWindowMenu(ev: React.MouseEvent) {
        // Figure out which window to create
        const id = await this.openContextMenu(ev, [
            { id: "chat", title: "New Chat Window" },
            { id: "files", title: "New Files Window" },
        ]);
        if (!id) return;
        // Create new window
        const windows = this.state.windows;
        if (id == "chat") {
            windows.push(<ChatWindow key={randomID()} />);
        }
        else if (id == "files") {
            windows.push(<FilesWindow key={randomID()} />);
        }
        console.log(windows);
        this.setState({ windows });
    }
}
