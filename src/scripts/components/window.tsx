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
    popOutData?: any;
}

export interface WindowState {
    display: DisplayState;
    x: number;
    y: number;
    z: number;
}


export class ApplicationWindow extends React.Component<WindowProps, WindowState> {
    titleHeight: number;

    constructor(props: WindowProps) {
        super(props);
        this.state = {
            display: DisplayState.Regular,
            x: props.left,
            y: props.top,
            z: getNextZIndex(),
        };
        this.titleHeight = 26;
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

    popOut(): Window {
        this.props.onClose(this.props.id);
        const popOut = window.open(
            "/pop-out",
            this.props.id,
            "toolbar=no,location=no,directories=no,status=no," +
            "menubar=no,scrollbars=yes,resizable=yes",
        );
        popOut.addEventListener('load', () => {
            popOut.postMessage({
                id: this.props.id,
                data: this.props.popOutData
            }, window.location.origin + "/pop-out");
            popOut.document.title = this.props.title;
        }, true);
        return popOut;
    }

    render() {
        /* Handle pop out windows */
        if (this.props.popOut) {
            return (
                <div id={this.props.id} className={`${this.props.className} window`}
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
                <div id={this.props.id} className={`${this.props.className} window`} style={{
                    zIndex: 0, width: "100%", height: "100%"
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
        /* Handle minimized and regular windows */
        let viewport;
        if (this.state.display !== DisplayState.Minimized) {
            // state.x is distance from left to the window, 4px in padding
            const xConstraint = document.body.clientWidth - (this.state.x + 4);
            // state.y is distance from top to the window, 4px in padding
            const yConstraint = document.body.clientHeight - (this.state.y + this.titleHeight + 4);
            viewport = (
                <ResizableBox className="viewport"
                    width={this.props.width} height={this.props.height}
                    maxConstraints={[xConstraint, yConstraint]}>
                    {this.props.children}
                </ResizableBox>
            );
        }
        return (
            <Draggable handle=".title-bar" bounds="body" onMouseDown={() => {
                this.setState({ z: getNextZIndex() });
            }} onStop={(_, data) => {
                this.setState({ x: this.props.left + data.x, y: this.props.top + data.y });
            }}>
                <div id={this.props.id} className={`${this.props.className} window`} style={{
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

    componentDidMount() {
        const window = document.getElementById(this.props.id);
        const titleBar = window.getElementsByClassName("title-bar").item(0);
        if (titleBar.clientHeight != this.titleHeight) {
            console.warn(`TitleBar Height ${this.titleHeight} -> ${titleBar.clientHeight}`);
        }
        this.titleHeight = titleBar.clientHeight;
    }
}
