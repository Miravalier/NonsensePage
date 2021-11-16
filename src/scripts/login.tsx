import "../styles/app.css";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { LoginWindow } from "./components/login-window";
import * as api from "./api";


console.log(`Canonhead login version ${__VERSION__}`);


$(async () => {
    const token = window.localStorage.getItem("token");
    if (token) {
        console.log("Auth token found.");
        try {
            const user = await api.currentUser();
            console.log("Token is valid, redirecting.");
            window.location.replace("/");
            return;
        }
        catch (e) {
            console.error(e);
            console.log("Token is invalid.");
        }
    }
    else {
        console.log("No auth token found.");
    }

    ReactDOM.render(
        <LoginWindow />,
        document.getElementById('root')
    );
});
