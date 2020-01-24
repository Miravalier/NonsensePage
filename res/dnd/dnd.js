// Configuration parameters
var attempts = 0;
var attempt_limit = 10;

// Mutable Globals
var auth2 = null;
var connection = null;
var connection_buffer = [];
var connection_activated = false;
var g_event_handlers = {};

const sleep = (milliseconds) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

// Constants

/************
 * D&D Code *
 ************/

var g_commands = {
    '/clear': function (args) {
        if (args.length != 1) {
            error_message("usage is /clear");
            return;
        }
        send_object({"type": "clear history"});
    },
    '/theme': function (args) {
        if (args.length != 2) {
            error_message("usage is /theme <fantasy | tech | icy>");
            return;
        }
        $("#background").attr("class", args[1]);
        $("#watermark").attr("class", args[1]);
        system_message(`'${args[1]}' theme applied.`);
    }
};


function window_execute_command()
{
    let message = this.text_input.value;
    if (message.length > 1024)
    {
        error_message("Your message is too long.");
        return;
    }
    else if (message[0] == '/')
    {
        let args = string_to_args(message);
        let command = args[0];
        if (command in g_commands)
        {
            g_commands[command](args);
        }
        else
        {
            error_message(`Unrecognized command '${command}'`);
        }
    }
    else
    {
        send_object({type: "chat message", text: message});
    }

    this.text_input.value = "";
}

/****************
 * Utility Code *
 ****************/

function set_cookie(key, value, persist)
{
    let cookie_string = `${key}=${value}; path=/`;

    if (persist)
    {
        let cookie_date = new Date;
        cookie_date.setFullYear(Date.getFullYear() + 10);
        cookie_string += `; expires=${cookie_date.toUTCString()}`;
    }

    document.cookie = cookie_string;
}

function get_cookie(key)
{
    var cookie_regex = new RegExp(`${key}=(.+?)\s*(;|$)`);
    let match = document.cookie.match(cookie_regex);
    if (match)
    {
        return match[1];
    }
    else
    {
        return null;
    }
}


/*******************
 * Connection Code *
 *******************/

function register_event(event_id, event_handler)
{
    if (event_id in g_event_handlers)
    {
        g_event_handlers[event_id].push(event_handler);
    }
    else
    {
        send_object({
            type: "register event",
            id: event_id
        });
        g_event_handlers[event_id] = [event_handler];
    }
}

function deregister_event(event_id, event_handler)
{

    // Remove event handler from event
    let handlers = g_event_handlers[event_id];
    let index = handlers.indexOf(event_handler)
    if (index != -1)
    {
        handlers.splice(index, 1);
    }

    // If this was the last event handler, remove the list
    // and inform the server.
    if (handlers.length == 0)
    {
        send_object({
            type: "deregister event",
            id: event_id
        });
        delete g_event_handlers[event_id];
    }
}

function error_message(text)
{
    local_event(-1, "chat message", {category: "Error", text: text, id: -1});
}

function system_message(text)
{
    local_event(-1, "chat message", {category: "System", text: text, id: -1});
}

function local_event(sim_user, event_id, event_data)
{
    if (event_id in g_event_handlers)
    {
        let message = {
            user: sim_user,
            id: event_id,
            data: event_data
        };
        for (handler of g_event_handlers[event_id])
        {
            handler(message);
        }
    }
    else
    {
        console.log(`Simulated un-handled event '${event_id}'`);
    }
}


function trigger_event(event_id, event_data)
{
    send_object({
        type: "trigger event",
        id: event_id,
        data: event_data
    });
}

function global_handler(event)
{
    try
    {
        var message = JSON.parse(event.data);
    }
    catch (e)
    {
        console.error(`Server message is not valid JSON: ${event.data}`);
        return;
    }

    if (message.type == "auth failure")
    {
        console.error("Authentication not accepted: " + message.reason);
        set_cookie("source", "/dnd")
        window.location.href = "/login";
    }
    else if (message.type == "auth success")
    {
        attempts = 0;
        console.log("[!] Authentication accepted");
        connection_activated = true;
        for (event_id of Object.keys(g_event_handlers))
        {
            send_object({
                type: "register event",
                id: event_id
            });
        }
        for (msg of connection_buffer)
        {
            console.log(`Sending ${msg} from the queue.`);
            connection.send(msg);
        }
        connection_buffer = [];
    }
    else if (message.type == "history reply") {
        let messages = message.messages;
        for (let i=messages.length-1; i >= 0; i--) {
            let [message_id, sender_id, category, display_name, content] = messages[i];
            local_event(sender_id, "chat message", {
                "category": category,
                "text": content,
                "id": message_id,
                "display name": display_name
            });
        }
    }
    else if (message.type == "prompt username") {
        select_username_dialog();
    }
    else if (message.type == "username update") {
        let id = message.id;
        let name = message.name;
        g_username_cache[id] = name;
        if (id in g_username_watchers) {
            let watchers = g_username_watchers[id];
            for (let i=0; i < watchers.length; i++) {
                watchers[i](name);
            }
            delete g_username_watchers[id];
        }
    }
    else if (message.type == "event")
    {
        if (message.id in g_event_handlers)
        {
            for (handler of g_event_handlers[message.id])
            {
                handler(message);
            }
        }
        else
        {
            console.log(`Received un-handled event '${message.id}' from '${message.user}'`);
        }
    }
    else if (message.type == "error")
    {
        console.error("Error from server: " + message.reason);
    }
    else if (message.type == "debug")
    {
        console.warn("Debug from server: " + message.data);
    }
    else
    {
        console.log(`Unknown Message: ${event.data}`);
    }
}

function send_auth_packet(auth2) {
    var google_user = auth2.currentUser.get();
    var id_token = google_user.getAuthResponse().id_token;

    connection.send(
        JSON.stringify({
            type: "auth",
            auth_token: id_token
        })
    )

    console.log("[!] Auth request sent")
}

function activate_connection()
{
    connection.onopen = undefined;

    console.log("[!] Loading google oauth2");
    send_auth_packet(auth2);
}

function reacquire_connection()
{
    connection_activated = false;
    close_connection();

    sleep(1000).then(() => {
        if (attempts > attempt_limit)
        {
            console.error("Too many connection attempts.");
            return;
        }
        acquire_connection();
        attempts++;
    })
}

function close_connection()
{
    connection.onopen = undefined;
    connection.onmessage = undefined;
    connection.onerror = undefined;
    connection.onclose = undefined;
    connection = null;
}

function acquire_connection()
{
    connection = new WebSocket("wss://miravalier.net:3030/");
    connection.onopen = activate_connection;
    connection.onmessage = global_handler;
    connection.onerror = reacquire_connection;
    connection.onclose = reacquire_connection;
}

function simulate_server_reply(data)
{
    let event = {"data": data};
    global_handler(event);
}

function send_object(data)
{
    send_string(JSON.stringify(data));
}

function send_string(data)
{
    if (connection.readyState == WebSocket.OPEN && connection_activated)
    {
        console.log(`Sending ${data}.`);
        connection.send(data);
    }
    else
    {
        console.log(`Queueing ${data} - not yet authenticated`);
        connection_buffer.push(data);
    }
}

/************
 * GUI Code *
 ************/
function create_context_menu(x, y, options, args)
{
    $("#g_context_menu").remove();

    let menu_html = "";
    Object.keys(options).forEach(function(category_name) {
        let category = options[category_name]
        menu_html += `<li class="ui-state-disabled unselectable"><div>${category_name}</div></li>`;
        Object.keys(category).forEach(function (option_name) {
            menu_html += `<li data-category="${category_name}"><div class="unselectable">${option_name}</div></li>`;
        });
    });

    // Create menu html
    var list = document.createElement('ul');
    list.id = "g_context_menu";
    list.innerHTML = menu_html;

    // Append html to DOM
    $("#tabletop").append(list);

    // Create menu widget
    menu = $(list)
    menu.menu({
        select: function (eventObject, ui) {
            let category = ui.item.data("category");
            let option = ui.item.text();
            let callback = options[category][option];
            if (callback) {
                callback(x, y, args);
            }
            menu.remove();
        }
    });

    menu.css("left", x);
    menu.css("top", y);
    return menu;
}

function select_username_dialog()
{
    let username_dialog = $(`<div title="Select Username">
        Username:
        <input type="text" class="name"></input>
    </div>`);
    $("#tabletop").append(username_dialog);
    username_dialog.dialog({
        resizable: false,
        height: "auto",
        width: 400,
        modal: true,
        buttons: {
            Confirm: function() {
                let name = username_dialog.find("input.name").val();
                send_object({type: "update username", name: name});
                $(this).dialog("close");
            }
        }
    });
}

function create_window(x, y, width, height)
{
    let window_element = $(`
        <div class="dnd_window" style="width: ${width}px; height: ${height}px; left: ${x}px; top: ${y}px; position: absolute;"></div>
    `);
    window_element.draggable({
        containment: "parent",
        snap: ".dnd_window"
    });
    window_element.resizable({
        containment: "parent",
        handles: 'all'
    });
    window_element.remove_handlers = [];
    window_element.register_event = window_register_event;

    window_element.options = {
        "Misc": {
            "Close": function() {
                window_element.remove_handlers.forEach(handler => {handler();});
                window_element.remove();
            }
        }
    };

    $("#tabletop").append(window_element);

    window_element.on("contextmenu", function (e) {
        create_context_menu(e.clientX, e.clientY, window_element.options);
        e.preventDefault();
        e.stopPropagation();
    });
    return window_element;
}

window_register_event = function (event_id, event_handler)
{
    register_event(event_id, event_handler);
    this.remove_handlers.push(function () {
        deregister_event(event_id, event_handler);
    });
}

function create_message(message_display, category, source, content)
{
    let message = $(`
        <div class="any_message ${category}_message">
            <h4>${source}:</h4><p>${content}</p>
        </div>
    `);
    message_display.append(message);
    message_display.scrollTop(message_display.prop('scrollHeight'));
}

function create_chat_window(x, y)
{
    var chat_window = create_window(x, y, 400, 400);
    chat_window.execute_command = window_execute_command;

    var message_display = $('<div class="message_display"></div>')
    chat_window.append(message_display);
    chat_window.message_display = message_display

    var text_input = document.createElement("input");
    text_input.setAttribute('class', 'message_input');
    text_input.setAttribute('type', 'text');
    text_input.setAttribute('name', 'message');
    text_input.setAttribute('autocomplete', 'off');
    text_input.addEventListener('keydown', function (event) {
        if (event.key == "Enter") {
            chat_window.execute_command()
        }
    });
    chat_window.append(text_input);
    chat_window.text_input = text_input;
    chat_window.message_set = new Set();

    chat_window.register_event("clear history", function (clear_event) {
        chat_window.message_set.clear();
        message_display.html("");
    });

    chat_window.register_event("chat message", function (chat_event) {
        let message = chat_event.data;
        if (message.id != -1 && chat_window.message_set.has(message.id))
        {
            // Discard messages we've already received unless
            // their id is -1 (internal)
            return;
        }
        chat_window.message_set.add(message.id);

        if (message.category == "Error")
        {
            create_message(message_display, "error", "Error", message.text);
        }
        else if (message.category == "System")
        {
            create_message(message_display, "system", "System", message.text);
        }
        else
        {
            let id = chat_event.user;
            let name = message["display name"];
            if (name) {
                create_message(message_display, "received", name, message.text);
            }
            else {
                let watcher = (function(name) {
                    create_message(message_display, "received", name, message.text);
                });

                if (id in g_username_watchers) {
                    g_username_watchers[id].push(watcher);
                }
                else {
                    g_username_watchers[id] = [watcher];
                }
                send_object({type: "query username", id: id});
            }
        }
    });

    send_object({"type": "request history"});

    return chat_window;
}

function create_button_window(x, y)
{
    let button_window = create_window(x, y, 500, 100);
    let button_display = $(`<div class="button_display"></div>`);
    button_window.options['Misc']['Add Button'] = (function () {
        button_display.append($(`<img class="window_button" src="/res/dnd/button.svg"></img>`));
    });
    button_window.append(button_display);
    return button_window;
}

function create_file_window(x, y)
{
    var file_window = create_window(x, y, 400, 400);

    /* TODO: Add create folder, download, and upload buttons */
    let file_viewport = $(`
        <div class="file_viewport"></div>
    `);
    file_window.append(file_viewport);

    /* TODO: Get root sections from server */
    var sections = ['Characters', 'Maps', 'Tokens'];

    for (section of sections)
    {
        let accordion = $(`
            <div class="directory">
                <h6>${section}</h6>
            </div>
        `)
        file_viewport.append(accordion)
        accordion.accordion({
            collapsible: true,
            icons: null
        });
    }

    return file_window;
}


var g_username_watchers = {};
var g_username_cache = {};
g_username_cache[-1] = "System";
function username_lookup(id) {
    if (id in g_username_cache) {
        return g_username_cache[id];
    }
    else
    {
        return null;
    }
}

function init() {
    gapi.load('auth2', function() {
        gapi.auth2.init({
            client_id: "667044129288-rqevl3vveam21qi315quafmr4nib2shn.apps.googleusercontent.com"
        }).then(function (value) {
            auth2 = value;
            acquire_connection();
        });
    });
}

// Main function
$("document").ready(function () {
    let tabletop = $("#tabletop");
    tabletop.on("click", function (e) {
        $("#g_context_menu").remove();
        e.stopPropagation();
    });
    tabletop.on("contextmenu", function (e) {
        create_context_menu(e.clientX, e.clientY, {
            'New': {
                'Chat': create_chat_window,
                'Buttons': create_button_window,
                'Files': create_file_window,
            },
            'Misc': {
                'Cancel': () => {}
            }
        });
        e.preventDefault();
        e.stopPropagation();
    });
});
