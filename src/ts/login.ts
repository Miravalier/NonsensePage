import { ApiRequest, LoginRequest, Session } from "./requests.js"
import { ErrorToast } from "./notifications.js";

async function AttemptLogin() {
    const username = document.querySelector<HTMLInputElement>("#login .username").value;
    if (!username) {
        ErrorToast("You must enter a username.");
        return;
    }
    const password = document.querySelector<HTMLInputElement>("#login .password").value;
    if (!password) {
        ErrorToast("You must enter a password.");
        return;
    }
    const response = await LoginRequest(username, password);
    if (response.status === "success") {
        console.log("Auth successful, redirecting to main application")
        window.location.href = "/";
    }
    else {
        ErrorToast("Login failed.");
    }
}

window.addEventListener("load", async () => {
    Session.token = localStorage.getItem("token");
    if (Session.token) {
        const response = await ApiRequest("/status");
        if (response.status === "success") {
            console.log("Auth successful, redirecting to main application")
            window.location.href = "/";
        }
        else {
            localStorage.removeItem("token");
        }
    }

    for (let inputElement of document.querySelectorAll<HTMLInputElement>("#login input")) {
        inputElement.addEventListener("keypress", ev => {
            if (ev.key == "Enter") {
                ev.preventDefault();
                AttemptLogin();
            }
        });
    }

    document.querySelector("#login .button").addEventListener("click", AttemptLogin);
});
