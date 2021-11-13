import "../styles/app.css";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { Desktop } from "./components/desktop";
import { client } from "./api";
import { ApolloProvider } from "@apollo/client";
import { ApplicationWindow } from "./components/window";


declare global {
    const __VERSION__: string;

    interface Window {
        desktop: Desktop;
        popOutData: any;
    }
}





console.log(`Canonfire version ${__VERSION__}`);
$(async () => {
    const token = window.localStorage.getItem("token");
    if (!token) {
        console.log("No auth token - redirecting to /login.");
        window.location.replace("/login");
        return;
    }

    ReactDOM.render(
        <Desktop token={token} />,
        document.getElementById('root')
    );
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


