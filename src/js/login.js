import { ApiRequest, LoginRequest, Session } from "./requests.js"
import { InfoToast, WarningToast, ErrorToast } from "./notifications.js";

window.addEventListener("load", async () => {
    window.InfoToast = InfoToast;
    window.ErrorToast = ErrorToast;
    window.WarningToast = WarningToast;

    Session.token = localStorage.getItem("token");
    if (Session.token) {
        const response = await ApiRequest("/status");
        console.log("Auth Status", response);

        if (response.status === "success") {
            console.log("Auth successful, redirecting to main application")
            window.location.href = "/";
        }
    }

    window.LoginRequest = LoginRequest;

    document.querySelector("#login .button").addEventListener("click", async () => {
        const username = document.querySelector("#login .username").value;
        if (!username) {
            ErrorToast("You must enter a username.");
            return;
        }
        const password = document.querySelector("#login .password").value;
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
    });
});
