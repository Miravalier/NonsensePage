import "../styles/app.css";

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as api from "./api";
import { User } from "./models";
import { Desktop } from "./components/desktop";
import { NotificationBar } from "./components/notifications";
import { ApolloProvider, gql } from "@apollo/client";
import { MESSAGE_SUBSCRIPTION, GET_MESSAGES } from "./gql";


declare global {
    const __VERSION__: string;

    interface Window {
        desktop: Desktop;
        notifications: NotificationBar;
        user: User;
    }
}


console.log(`Canonhead version ${__VERSION__}`);
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

    // Connect to messages subscription
    const messageSub = api.client.subscribe({ query: MESSAGE_SUBSCRIPTION });
    messageSub.forEach(async response => {
        const update = response.data.messages;
        response = await api.client.query({ query: GET_MESSAGES, variables: { chatId: update.chatId } });
        const messages = [...response.data.chat.messages];
        let existing = false;
        for (let message of messages) {
            if (message.id === update.message.id) {
                Object.assign(message, update.message);
                existing = true;
                break;
            }
        }
        if (!existing) {
            messages.push(update.message);
        }
        api.client.writeFragment({
            id: `Chat:${update.chatId}`,
            fragment: gql`
                fragment ChatUpdate on Chat {
                    messages
                }
            `,
            data: {
                messages,
            }
        });
    })

    // Render the desktop
    ReactDOM.render(
        <ApolloProvider client={api.client}>
            <Desktop />
            <NotificationBar />
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



