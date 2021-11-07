import * as React from "react";
import Draggable from "react-draggable";
import { ResizableBox } from "react-resizable";
import { getNextZIndex } from "../positioning";


export interface WindowProps {
    id: string;
    title: string;
    className: string;
    width: number;
    height: number;
    onClose: (windowId: string) => void;
    left?: number;
    top?: number;
}
export interface WindowState {
    minimized: boolean;
    z: number;
}


export class ApplicationWindow extends React.Component<WindowProps, WindowState> {
    constructor(props: WindowProps) {
        super(props);
        this.state = { minimized: false, z: getNextZIndex() };
    }

    toggleMinimize() {
        this.setState({ minimized: !this.state.minimized });
    }

    render() {
        let viewport;
        if (!this.state.minimized) {
            viewport = (
                <ResizableBox className="viewport"
                    width={this.props.width} height={this.props.height}>
                    {this.props.children}
                </ResizableBox>
            );
        }
        return (
            <Draggable handle=".title-bar" bounds="body" onMouseDown={() => {
                this.setState({ z: getNextZIndex() });
            }}>
                <div className={`${this.props.className} window`} style={{
                    left: this.props.left, top: this.props.top, zIndex: this.state.z
                }}>
                    <div className="title-bar" onDoubleClick={() => this.toggleMinimize()}>
                        <div className="title">{this.props.title}</div>
                        <div className="minimize button" onClick={() => this.toggleMinimize()}>
                            <i className={`fas fa-window-${this.state.minimized ? "maximize" : "minimize"}`}></i>
                        </div>
                        <div className="close button" onClick={() => this.props.onClose(this.props.id)}>
                            <i className="fas fa-window-close"></i>
                        </div>
                    </div>
                    {viewport}
                </div>
            </Draggable>
        );
    }
}
