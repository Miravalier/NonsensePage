import "../styles/app.css";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { Desktop } from "./components/desktop";


declare global {
    const __VERSION__: string;

    interface Window {
        desktop: Desktop;
        popOutData: any;
    }
}


console.log(`Canonfire version ${__VERSION__}`);
$(() => {
    ReactDOM.render(
        <Desktop />,
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


