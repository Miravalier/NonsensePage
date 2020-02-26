/*************
 * INTERNALS *
 *************/

var g_cache = {};
var g_admin = false;
var g_id = null;
var g_auth2 = null;
var g_connection = null;
var g_connection_buffer = [];
var g_connection_activated = false;
var g_waiting_promises = {};
var g_message_handlers = {};
var g_connection_delay = 500;


function init() {
    gapi.load('auth2', function() {
        gapi.auth2.init({
            client_id: "667044129288-1labkcbi5eokimdprnu2n77u4332cvmu.apps.googleusercontent.com"
        }).then(function (value) {
            g_auth2 = value;
            acquire_connection();
        });
    });
}


function global_handler(event)
{
    if (event.data instanceof Blob) {
        event.data.arrayBuffer().then(buffer => {
            let view = new DataView(buffer);
            let request_id = view.getUint32(0);
            let binary_data = new Uint8Array(buffer, 4, buffer.byteLength-4);
            var message = {type: "binary", "request id": request_id, data: binary_data}
            message_sorter(message);
        });
    }
    else if (event.data instanceof ArrayBuffer) {
        let view = new DataView(event.data);
        let request_id = view.getUint32(0);
        let binary_data = new Uint8Array(event.data, 4, event.data.byteLength-4);
        var message = {type: "binary", "request id": request_id, data: binary_data}
        message_sorter(message);
    }
    else {
        try {
            var message = JSON.parse(event.data);
        }
        catch (e) {
            console.error(`Server message is not valid JSON: ${event.data}`);
            return;
        }
        message_sorter(message);
    }
}


function message_sorter(message) {
    // Resolve promises
    let message_request_id = message["request id"];
    if (message_request_id in g_waiting_promises) {
        let [data, resolve] = g_waiting_promises[message_request_id];
        if (message.type == "error") {
            console.error("Error received in reply to request from server: " + message.reason);
            console.error("Request was: " + JSON.stringify(data));
        }
        resolve(message);
        delete g_waiting_promises[message_request_id];
        return;
    }

    // Handle other messages
    if (message.type == "auth failure") {
        console.error("Authentication not accepted: " + message.reason);
        window.location.href = "/login";
    }
    else if (message.type == "auth success") {
        g_id = message.id;
        g_admin = message.admin;
        g_connection_delay = 500;
        console.log("[!] Authentication accepted");
        g_connection_activated = true;
        for (let msg of g_connection_buffer) {
            g_connection.send(msg);
        }
        for (let request_id of Object.keys(g_waiting_promises)) {
            let [data, resolve] = g_waiting_promises[request_id];
            send_object(data);
        }
        g_connection_buffer = [];
    }
    else if (message.type == "error") {
        console.error("Error from server: " + message.reason);
        if ('request' in message) {
            console.log("Error request was: " + message.request);
        };
    }
    else if (message.type == "debug") {
        console.warn("Debug from server: " + message.reason);
    }
    else if (message.type in g_message_handlers) {
        for (let message_handler of g_message_handlers[message.type]) {
            message_handler(message);
        }
    }
    else {
        console.log(`Unhandled Message: ${JSON.stringify(message)}`);
    }
}


function activate_connection() {
    g_connection.onopen = undefined;

    console.log("[!] Loading google oauth2");
    var google_user = g_auth2.currentUser.get();
    var id_token = google_user.getAuthResponse().id_token;

    g_connection.send(
        JSON.stringify({
            type: "auth",
            auth_token: id_token
        })
    )
    console.log("[!] Auth request sent")
}


function reacquire_connection() {
    close_connection();
    console.error("Reacquiring connection ...")
    sleep(g_connection_delay).then(() => {
        acquire_connection();
        g_connection_delay += 500;
    })
}


function close_connection() {
    g_connection_activated = false;
    g_connection.onopen = undefined;
    g_connection.onmessage = undefined;
    g_connection.onerror = undefined;
    g_connection.onclose = undefined;
    g_connection = null;
}


function acquire_connection() {
    g_connection = new WebSocket("wss://nonsense.page:3030/");
    g_connection.onopen = activate_connection;
    g_connection.onmessage = global_handler;
    g_connection.onerror = reacquire_connection;
    g_connection.onclose = reacquire_connection;
}


/****************
 * EXTERNAL USE *
 ****************/

const sleep = (milliseconds) => {
    return new Promise(resolve => setTimeout(resolve, milliseconds))
}


function local_object(data) {
    message_sorter(data);
}


function send_object(data) {
    send_raw(JSON.stringify(data));
}


function send_raw(data) {
    if (g_connection && g_connection.readyState == WebSocket.OPEN && g_connection_activated) {
        g_connection.send(data);
    }
    else {
        g_connection_buffer.push(data);
    }
}


function send_request(data) {
    let request_id = Math.floor(Math.random()*4294967295);
    data["request id"] = request_id;
    return new Promise((resolve, reject) => {
        g_waiting_promises[request_id] = [data, resolve];
        send_object(data);
    });
}


function deregister_message(message_type, message_handler) {
    let handler_list = g_message_handlers[message_type];
    if (!handler_list) {
        return;
    }

    let index = handler_list.indexOf(message_handler);
    if (index != -1) {
        handler_list.splice(index, 1);
    }
}


function register_message(message_type, message_handler) {
    if (message_type in g_message_handlers) {
        g_message_handlers[message_type].push(message_handler);
    }
    else {
        g_message_handlers[message_type] = [message_handler];
    }
}
