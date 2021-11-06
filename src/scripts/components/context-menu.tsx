import * as React from "react";

export interface ContextMenuOption {
    id: string;
    title: string;
    tooltip?: string;
}

interface ContextMenuProps { }

interface ContextMenuState {
    style: React.CSSProperties;
    options: ContextMenuOption[];
    callback?: (value?: any | PromiseLike<any>) => void;
}

export class ContextMenu extends React.Component<ContextMenuProps, ContextMenuState> {
    constructor(props: ContextMenuProps) {
        super(props);
        this.state = {
            style: { display: "none" },
            options: [],
        };
    }

    resolve(id: string): void {
        const callback = this.state.callback;
        this.setState({
            callback: null,
            style: {
                display: "none",
            },
        });
        callback(id);
    }

    render() {
        const options = [];
        for (let option of this.state.options) {
            options.push(
                <div className="option"
                    data-id={option.id}
                    key={option.id}
                    onClick={(ev) => {
                        ev.stopPropagation();
                        this.resolve(option.id);
                    }}
                >
                    {option.title}
                </div>
            );
        }
        return (
            <div id="context-menu" style={this.state.style}>
                {options}
            </div>
        );
    }
}
