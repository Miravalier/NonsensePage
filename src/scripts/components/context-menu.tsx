import * as React from "react";

export interface ContextMenuOption {
    id: string;
    title: string;
    shortcut?: string;
}

interface ContextMenuProps { }

interface ContextMenuState {
    title: string;
    style: React.CSSProperties;
    options: ContextMenuOption[];
    callback?: (value?: any | PromiseLike<any>) => void;
}

export class ContextMenu extends React.Component<ContextMenuProps, ContextMenuState> {
    constructor(props: ContextMenuProps) {
        super(props);
        this.state = {
            title: "Context Menu",
            style: { display: "none" },
            options: [],
        };
    }

    resolve(id: string): void {
        if (this.state.callback) {
            this.state.callback(id);
        }
    }

    render() {
        const options = [];
        for (let option of this.state.options) {
            options.push(
                <div className="option"
                    data-id={option.id}
                    key={option.id}
                    onClick={(ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        this.resolve(option.id);
                    }}
                >
                    <div>{option.title}</div>
                    <div className="shortcut">{option.shortcut}</div>
                </div>
            );
        }
        return (
            <div id="context-menu" style={this.state.style}>
                <div className="title">{this.state.title}</div>
                {options}
            </div>
        );
    }
}
