import { ErrorToast } from "./notifications.ts";


export class Session {
    static token: string = null as any;
    static gm = false;
    static username = "<Invalid>";
    static id: string = null as any;
    static ws: WebSocket;
    static subscriptions: { [pool: string]: Set<Subscription> } = {};
}


export function HandleWsMessage(data: any) {
    const pool = Session.subscriptions[data.pool];
    if (!pool) {
        console.warn(`Ignoring message bound for pool: ${data.pool}`)
        return;
    }
    for (let subscription of pool) {
        try {
            subscription.callback(data);
        } catch (error) {
            console.error(error);
        }
    }
}


export async function WsConnect() {
    let ws_prefix = (window.location.protocol === "https:" ? "wss:" : "ws:");
    Session.ws = new WebSocket(`${ws_prefix}//${window.location.host}/api/live`);
    Session.ws.onopen = () => {
        Session.ws.send(JSON.stringify({ "token": Session.token }));
        for (let [pool, subscription_set] of Object.entries(Session.subscriptions)) {
            if (subscription_set.size != 0) {
                Session.ws.send(JSON.stringify({ type: "subscribe", pool }));
            }
        }
    }
    Session.ws.onmessage = ev => {
        const data = JSON.parse(ev.data);
        HandleWsMessage(data);
    };
    Session.ws.onclose = async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        WsConnect();
    };
}


export class Subscription {
    pool: string;
    callback: CallableFunction;

    constructor(pool: string, callback: CallableFunction) {
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


export async function Subscribe(pool: string, callback: CallableFunction): Promise<Subscription> {
    let subscription_set = Session.subscriptions[pool];
    if (!subscription_set) {
        subscription_set = new Set();
        Session.subscriptions[pool] = subscription_set;
    }
    if (subscription_set.size == 0 && Session.ws && Session.ws.readyState == WebSocket.OPEN) {
        Session.ws.send(JSON.stringify({ type: "subscribe", pool }));
    }
    let subscription = new Subscription(pool, callback);
    subscription_set.add(subscription);
    return subscription;
}


export async function FetchHtml(url: string): Promise<Document> {
    const response = await fetch(url);
    const text = await response.text();
    return new DOMParser().parseFromString(text, 'text/html');
}


export async function LoginRequest(username: string, password: string) {
    Session.token = null as any;
    const response: {
        status: string;
        token: string;
        gm: boolean;
        id: string;
    } = await ApiRequest("/login", { username, password });
    if (response.status === "success") {
        localStorage.setItem("token", response.token);
        Session.token = response.token;
    }
    Session.gm = response.gm;
    Session.id = response.id;
    Session.username = username;
    return response;
}


export async function ApiRequest(endpoint: string, data: any = null): Promise<any> {
    if (data == null) data = {};
    if (Session.token !== null) {
        data.token = Session.token;
    }
    console.log("[API REQUEST]", endpoint, data);
    const response = await fetch(`/api${endpoint}`, {
        method: 'POST',
        cache: 'no-cache',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data),
    });

    // 5XX Response, Server Error
    if (response.status >= 500 && response.status < 600) {
        ErrorToast("Encountered an error making an API request.");
        throw `[API ERROR] ${response.status} ${response.statusText}`;
    }

    const replyData = await response.json();
    if (response.status == 422) {
        for (let item of replyData.detail) {
            console.error(`Error 422: ${item.msg}: ${item.loc.slice(1).join(", ")}`);
        }
    }

    console.log("[API REPLY]", replyData);
    return replyData;
}


export async function FileUpload(file: File, path: string) {
    const formData = new FormData();
    formData.append('token', Session.token);
    formData.append('path', path)
    formData.append('file', file, file.name)
    await fetch("/api/files/upload", {
        method: 'POST',
        body: formData,
    });
}
