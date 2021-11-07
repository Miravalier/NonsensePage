import * as React from "react";
import * as ReactDOM from "react-dom";
import Draggable from "react-draggable";
import { ResizableBox } from "react-resizable";
import { getNextZIndex } from "../positioning";

enum DisplayState {
    Regular,
    Expanded,
    Minimized,
}

export interface WindowProps {
    id: string;
    title: string;
    className: string;
    width: number;
    height: number;
    onClose: (windowId: string) => void;
    left?: number;
    top?: number;
    popOut?: boolean;
}
export interface WindowState {
    display: DisplayState
    z: number;
}


export class ApplicationWindow extends React.Component<WindowProps, WindowState> {
    constructor(props: WindowProps) {
        super(props);
        this.state = {
            display: DisplayState.Regular,
            z: getNextZIndex()
        };
    }

    toggleExpand() {
        if (this.state.display === DisplayState.Expanded) {
            this.setState({ display: DisplayState.Regular });
        }
        else {
            this.setState({ display: DisplayState.Expanded });
        }
    }

    toggleMinimize() {
        if (this.state.display === DisplayState.Minimized) {
            this.setState({ display: DisplayState.Regular });
        }
        else {
            this.setState({ display: DisplayState.Minimized });
        }
    }

    popOut() {
        this.props.onClose(this.props.id);
        const popOut = window.open("/pop-out", this.props.id, "toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=yes,resizable=yes");

        popOut.addEventListener('load', () => {
            popOut.document.title = this.props.title;
            ReactDOM.render(
                <ApplicationWindow {...this.props} popOut={true} />,
                popOut.document.getElementById("root")
            );
        }, true);
    }

    render() {
        /* Handle pop out windows */
        if (this.props.popOut) {
            return (
                <div className={`${this.props.className} window`}
                    style={{ width: "100%", height: "100%" }}>
                    <div className="viewport">
                        {this.props.children}
                    </div>
                </div>
            );
        }
        /* Handle expanded windows */
        if (this.state.display === DisplayState.Expanded) {
            return (
                <div className={`${this.props.className} window`} style={{
                    zIndex: this.state.z, width: "100%", height: "100%"
                }}>
                    <div className="title-bar" onDoubleClick={() => this.toggleMinimize()}>
                        <div className="title">{this.props.title}</div>
                        <div className="pop-out button" onClick={() => this.popOut()}>
                            <i className="fas fa-external-link-square"></i>
                        </div>
                        <div className="minimize button" onClick={() => this.toggleMinimize()}>
                            <i className="fas fa-window-minimize"></i>
                        </div>
                        <div className="compress button" onClick={() => this.toggleExpand()}>
                            <i className="fas fa-compress-alt"></i>
                        </div>
                        <div className="close button" onClick={() => this.props.onClose(this.props.id)}>
                            <i className="fas fa-window-close"></i>
                        </div>
                    </div>
                    <div className="viewport">
                        {this.props.children}
                    </div>
                </div>
            );
        }
        /* Handle minimized windows */
        let viewport;
        if (this.state.display !== DisplayState.Minimized) {
            viewport = (
                <ResizableBox className="viewport"
                    width={this.props.width} height={this.props.height}>
                    {this.props.children}
                </ResizableBox>
            );
        }
        /* Handle regular windows */
        return (
            <Draggable handle=".title-bar" bounds="body" onMouseDown={() => {
                this.setState({ z: getNextZIndex() });
            }}>
                <div className={`${this.props.className} window`} style={{
                    left: this.props.left, top: this.props.top, zIndex: this.state.z
                }}>
                    <div className="title-bar" onDoubleClick={() => this.toggleMinimize()}>
                        <div className="title">{this.props.title}</div>
                        <div className="pop-out button" onClick={() => this.popOut()}>
                            <i className="fas fa-external-link-square"></i>
                        </div>
                        <div className="minimize button" onClick={() => this.toggleMinimize()}>
                            <i className={`fas fa-window-${this.state.display === DisplayState.Minimized ? "maximize" : "minimize"}`}></i>
                        </div>
                        <div className="expand button" onClick={() => this.toggleExpand()}>
                            <i className="fas fa-expand-alt"></i>
                        </div>
                        <div className="close button" onClick={() => this.props.onClose(this.props.id)}>
                            <i className="fas fa-window-close"></i>
                        </div>
                    </div>
                    {viewport}
                </div>
            </Draggable >
        );
    }
}
