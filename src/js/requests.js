export class Session {
    static token = null;
    static gm = false;
    static username = "<Invalid>";
}


export async function FetchHtml(url) {
    const response = await fetch(url);
    const text = await response.text();
    return new DOMParser().parseFromString(text, 'text/html');
}


export async function LoginRequest(username, password) {
    Session.token = null;
    const response = await ApiRequest("/login", { username, password });
    if (response.status === "success") {
        localStorage.setItem("token", response.token);
        Session.token = response.token;
    }
    Session.gm = response.gm;
    Session.username = username;
    return response;
}


export async function ApiRequest(endpoint, data) {
    if (!data) data = {};
    if (Session.token !== null) {
        data.token = Session.token;
    }
    const response = await fetch(`/api${endpoint}`, {
        method: 'POST',
        cache: 'no-cache',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data),
    });
    const replyData = await response.json();
    if (response.status == 422) {
        for (let item of replyData.detail) {
            console.error(`${item.msg}: ${item.loc.slice(1).join(", ")}`);
        }
    }
    console.log("[API REQUEST]", endpoint, data);
    console.log("[API REPLY]", replyData);
    return replyData;
}
