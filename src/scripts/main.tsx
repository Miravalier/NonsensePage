import "../styles/app.css";

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as api from "./api";
import { User } from "./models";
import { Desktop } from "./components/desktop";
import { ApolloProvider } from "@apollo/client";
import { MESSAGE_SUBSCRIPTION, GET_MESSAGES } from "./gql";


declare global {
    const __VERSION__: string;

    interface Window {
        desktop: Desktop;
        user: User;
        api: any;
    }
}
window.api = api;


console.log(`Canonfire version ${__VERSION__}`);
$(async () => {
    // Verify a valid token
    const token = window.localStorage.getItem("token");
    if (!token) {
        console.log("No auth token - redirecting to /login.");
        window.location.replace("/login");
        return;
    }
    try {
        window.user = await api.currentUser();
        console.log(`Signed in as user "${window.user.name}"`);
    }
    catch (e) {
        console.error(e);
        console.log("Auth token is invalid.");
        window.location.replace("/login");
        return;
    }

    // Connect to message subscription
    const messageSub = api.client.subscribe({ query: MESSAGE_SUBSCRIPTION });
    messageSub.forEach(message => {
        const messageData = message.data;
        messageData.__typename = 'Message';
        const cachedData = api.client.readQuery({ query: GET_MESSAGES, variables: { chatId: "current" } });
        const messages: Array<any> = cachedData.chat.messages;
        let existing = false;
        for (let message of messages) {
            if (message.id === messageData.id) {
                Object.assign(message, messageData);
                existing = true;
                break;
            }
        }
        if (!existing) {
            messages.push(messageData);
        }
        api.client.writeQuery({
            query: GET_MESSAGES,
            variables: { chatId: "current" },
            data: {
                chat: {
                    messages,
                }
            }
        });
    })

    // Render the desktop
    ReactDOM.render(
        <ApolloProvider client={api.client}>
            <Desktop />
        </ApolloProvider>,
        document.getElementById('root')
    );

    // Add escape listener for context menu
    document.addEventListener('keydown', ev => {
        if (window.desktop.contextResolve) {
            if (ev.code == "Escape") {
                window.desktop.contextResolve(null);
            }
            else {
                window.desktop.contextResolve(ev.code);
            }
        }
    });
});


