export class RequestSession {
    static token = null;
}


export async function LoginRequest(username, password) {
    RequestSession.token = null;
    const response = await ApiRequest("/login", { username, password });
    if (response.status === "success") {
        localStorage.setItem("token", response.token);
        RequestSession.token = response.token;
    }
    return response;
}


export async function ApiRequest(endpoint, data) {
    if (!data) data = {};
    if (RequestSession.token !== null) {
        data.token = RequestSession.token;
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
    return replyData;
}
