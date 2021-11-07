import '../styles/app.css'

import * as React from "react";
import * as ReactDOM from "react-dom";
import { Desktop } from "./components/desktop";


declare global {
    const __VERSION__: string;

    interface Window {
        desktop: Desktop;
    }
}


console.log(`Canonfire version ${__VERSION__}`);
$(() => {
    ReactDOM.render(
        <Desktop />,
        document.getElementById('root')
    );
});

