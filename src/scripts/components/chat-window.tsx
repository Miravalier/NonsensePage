import * as React from "react";
import { ApplicationWindow } from "./window";
import { useQuery, useMutation } from '@apollo/client';
import { GET_MESSAGES, SEND_MESSAGE } from "../gql";
import { randomID, displayDate } from "../utilities";

export interface ChatWindowProps {
    chatId: string;
    id: string;
    onClose: (windowId: string) => void;
    left?: number;
    top?: number;
};

export function ChatWindow(props: ChatWindowProps) {
    const [sendMessage, { }] = useMutation(SEND_MESSAGE);
    const [chatId, setChatId] = React.useState(props.chatId);
    const [inputText, setInputText] = React.useState("");
    const [scrollId, setScrollId] = React.useState(randomID());

    React.useEffect(() => {
        const element = document.getElementById(scrollId);
        if (element !== null) {
            element.parentElement.scrollTop = element.parentElement.scrollHeight;
        }
    });

    async function onKeyDown(ev: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (ev.key !== "Enter") return;
        ev.preventDefault();
        const content = inputText;
        const sentChatId = chatId;
        setInputText("");
        // Send new message to the server
        sendMessage({
            variables: {
                chatId: sentChatId,
                language: "Common",
                content,
                speakerId: "",
                speakerName: window.user.name,
            }
        });
    }

    const { loading, error, data } = useQuery(
        GET_MESSAGES,
        { variables: { chatId } },
    );

    let content: any;
    let input: any = null;
    if (loading) {
        content = <div className="status">Loading ...</div>
    }
    else if (error) {
        content = <div className="status">Error, chat failed to load.</div>
    }
    else {
        content = [];
        for (let message of data.chat.messages) {
            const date = new Date(message.timestamp + "Z");
            content.push(
                <div className="message" key={message.id}>
                    <div className="header">
                        <div className="speaker">{message.speakerName}</div>
                        <div className="timestamp">{displayDate(date)}</div>
                    </div>
                    <div className="content">{message.content}</div>
                </div>
            );
        }
        input = (
            <div className="input-section">
                <div className="compose-area">
                    <textarea value={inputText} onChange={ev => setInputText(ev.target.value)}
                        onKeyDown={ev => onKeyDown(ev)} />
                </div>
            </div>
        );
    }
    return (
        <ApplicationWindow className="chat" title="Chat" id={props.id}
            width={400} height={600} onClose={(windowId) => props.onClose(windowId)}
            left={props.left} top={props.top} >
            <div id={scrollId} className="messages">
                {content}
            </div>
            {input}
        </ApplicationWindow>
    );
}
