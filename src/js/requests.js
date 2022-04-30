export class Session {
    static token = null;
    static gm = false;
    static username = "<Invalid>";
    static ws = null;
    static subscriptions = {};
}


export async function WsConnect() {
    let ws_prefix = (window.location.protocol === "https:" ? "wss:" : "ws:");
    Session.ws = new WebSocket(`${ws_prefix}//${window.location.host}/api/live`);
    Session.ws.onopen = ev => {
        Session.ws.send(JSON.stringify({ "token": Session.token }));
    }
    Session.ws.onmessage = ev => {
        const data = JSON.parse(ev.data);
        const pool = Session.subscriptions[data.pool];
        if (!pool) {
            console.warn(`Ignoring message bound for pool: ${data.pool}`)
            return;
        }
        for (let subscription of pool) {
            subscription.callback(data);
        }
    };
    Session.ws.onclose = async ev => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        WsConnect();
    };
    setInterval(() => {
        Session.ws.send(JSON.stringify({ type: "heartbeat" }));
    }, 5000);
}


export class Subscription {
    constructor(pool, callback) {
        this.pool = pool;
        this.callback = callback;
    }

    cancel() {
        let subscription_set = Session.subscriptions[this.pool];
        subscription_set.delete(this);
        if (subscription_set.size == 0) {
            Session.ws.send(JSON.stringify({ type: "unsubscribe", pool: this.pool }));
        }
    }
}


export async function Subscribe(pool, callback) {
    let subscription_set = Session.subscriptions[pool];
    if (!subscription_set) {
        subscription_set = new Set();
        Session.subscriptions[pool] = subscription_set;
    }
    if (subscription_set.size == 0) {
        Session.ws.send(JSON.stringify({ type: "subscribe", pool }));
    }
    let subscription = new Subscription(pool, callback);
    subscription_set.add(subscription);
    return subscription;
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
