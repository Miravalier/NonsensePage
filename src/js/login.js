import { ApiRequest, LoginRequest, RequestSession } from "./requests.js"
import { ErrorToast } from "./notifications.js";

$(async () => {
    RequestSession.token = localStorage.getItem("token");
    if (RequestSession.token) {
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
        const password = $("#login .password").val();
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
