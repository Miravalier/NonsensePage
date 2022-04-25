import { ApiRequest, LoginRequest, Session } from "./requests.js"
import { InfoToast, WarningToast, ErrorToast } from "./notifications.js";

$(async () => {
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

    $("#login .button").on("click", async () => {
        const username = $("#login .username").val();
        if (!username) {
            ErrorToast("You must enter a username.");
            return;
        }
        const password = $("#login .password").val();
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
