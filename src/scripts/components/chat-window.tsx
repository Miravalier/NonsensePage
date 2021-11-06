import * as React from "react";

interface ChatWindowProps { }

interface ChatWindowState { }

export class ChatWindow extends React.Component<ChatWindowProps, ChatWindowState> {
    constructor(props: ChatWindowProps) {
        super(props);
    }

    render() {
        return (
            <div className="chat window">
                Chat Window
            </div>
        );
    }
}
