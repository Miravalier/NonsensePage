import * as React from "react";
import { ApplicationWindow } from "./window";
import { useQuery, useMutation } from '@apollo/client';
import { GET_MESSAGES, SEND_MESSAGE } from "../gql";
import { client } from "../api";

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

    async function onSend() {
        const content = inputText;
        const sentChatId = chatId;
        setInputText("");
        // Send new message to the server
        const sendResult = sendMessage({
            variables: {
                chatId: sentChatId,
                language: "Common",
                content,
                speakerId: "",
                speakerName: "Gamemaster",
            }
        });
        // Update cached data locally
        const responseData = (await sendResult).data
        const cachedData = client.readQuery({ query: GET_MESSAGES, variables: { chatId: sentChatId } });
        const newMessage = {
            id: responseData.id,
            timestamp: responseData.timestamp,
            speakerName: "Gamemaster",
            content,
            __typename: 'Message',
        };
        client.writeQuery({
            query: GET_MESSAGES,
            variables: { chatId: sentChatId },
            data: {
                chat: {
                    messages: [...cachedData.chat.messages, newMessage],
                }
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
            content.push(
                <div className="message" key={message.id}>
                    <div className="header">
                        <div className="speaker">{message.speakerName}</div>
                        <div className="timestamp">{message.timestamp}</div>
                    </div>
                    <div className="content">{message.content}</div>
                </div>
            );
        }
        input = (
            <div className="input">
                <input type="text" value={inputText} onChange={ev => setInputText(ev.target.value)} />
                <div className="button" onClick={ev => onSend()}>Send</div>
            </div>
        );
    }
    return (
        <ApplicationWindow className="chat" title="Chat" id={props.id}
            width={400} height={600} onClose={(windowId) => props.onClose(windowId)}
            left={props.left} top={props.top}>
            <div className="messages">
                {content}
            </div>
            {input}
        </ApplicationWindow>
    );
}
