// Configuration parameters
var attempt_limit = 10;

// Mutable Globals
var connection = null;
var connection_buffer = [];
var connection_activated = false;
var g_event_handlers = {};
acquire_connection();

// Constants

/************
 * D&D Code *
 ************/

var g_commands = {
    '/theme': function (args) {
        if (args.length != 2)
        {
            error_message("usage is /theme <fantasy | tech | icy>");
            return;
        }
        $("#background").attr("class", args[1]);
        $("#watermark").attr("class", args[1]);
        system_message(`'${args[1]}' theme applied.`);
    }
};

//var command_regex = /(?<cmd>[^ \t\n]+)(\s+(?<arg>([^ \t\n]+)|("[^"]+")|('[^']+')))*/;
function parse_command(message)
{
    let words = message.split(/\s+/);
    return [words[0], words];
}

function window_execute_command()
{
    var message = this.text_input.value;
    if (message.length > 1024)
    {
        error_message("Your message is too long.");
        return;
    }
    else if (message[0] == '/')
    {
        var [command, args] = parse_command(message);
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
        trigger_event("chat message", message);
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
    simulate_event("Error", "chat message", text);
}

function system_message(text)
{
    simulate_event("System", "chat message", text);
}

function simulate_event(sim_user, event_id, event_data)
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

function message_handler(event)
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

    gapi.load('auth2', function() {
        gapi.auth2.init({
            client_id: "667044129288-rqevl3vveam21qi315quafmr4nib2shn.apps.googleusercontent.com"
        }).then(function (auth2) {
            send_auth_packet(auth2);
        });
    });
}

function acquire_connection()
{
    connection_activated = false;
    connection = new WebSocket("wss://miravalier.net:3030/");
    connection.onopen = activate_connection;
    connection.onmessage = message_handler;
    connection.onerror = acquire_connection;
    connection.onclose = acquire_connection;
}

function simulate_server_reply(data)
{
    let event = {"data": data};
    message_handler(event);
}

function send_object(data)
{
    send_string(JSON.stringify(data));
}

function send_string(data)
{
    if (connection.readyState == WebSocket.OPEN && connection_activated)
    {
        console.log(`Sending ${data} immediately.`);
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
function create_background_menu(x, y)
{
    var menu = $("#background_menu");
    if (!menu.length)
    {
        // Create menu html
        var list = document.createElement('ul');
        list.id = "background_menu";
        list.innerHTML = `
            <li class="ui-state-disabled unselectable"><div>New</div></li>
            <li><div class="unselectable">Chat</div></li>
            <li><div class="unselectable">Buttons</div></li>
            <li><div class="unselectable">Files</div></li>
            <li class="ui-state-disabled unselectable"><div>Misc.</div></li>
            <li><div class="unselectable">Cancel</div></li>
        `;

        // Append html to DOM
        $("#tabletop").append(list);

        // Create menu widget
        menu = $(list)
        menu.menu({
            select: function (eventObject, ui) {
                background_menu_function_map[ui.item.text()](x, y);
                menu.remove();
            }
        });
    }

    // Move menu here
    menu.css("left", x);
    menu.css("top", y);
}

function create_window(x, y, width, height)
{
    var _window_element = document.createElement('div');
    $("#tabletop").append(_window_element);
    _window_element.setAttribute("class", "dnd_window");
    var _window = $(_window_element);
    var close_button_element = document.createElement('button');
    close_button_element.setAttribute("type", "button");
    close_button_element.setAttribute("class", "close_button");
    close_button_element.addEventListener("click", function () {
        if (_window.remove_handler !== undefined)
        {
            _window.remove_handler();
        }
        _window.remove();
    });
    var svg_element = document.createElement('img');
    svg_element.setAttribute('class', 'button_svg');
    svg_element.setAttribute('src', '/res/dnd/trash.svg');
    svg_element.setAttribute('alt', 'Close Window');
    close_button_element.appendChild(svg_element);
    _window_element.appendChild(close_button_element);
    _window.draggable({
        containment: "parent",
        snap: ".dnd_window"
    });
    _window.resizable({
        containment: "parent",
        handles: 'all'
    });
    _window.css("left", x);
    _window.css("top", y);
    _window.css("width", width);
    _window.css("height", height);
    _window.register_event = window_register_event;
    _window.execute_command = window_execute_command;
    return _window;
}

window_register_event = function (event_id, event_handler)
{
    register_event(event_id, event_handler);
    this.remove_handler = function () {
        deregister_event(event_id, event_handler);
    }
}

function create_message(message_display, category, source, content)
{
    let content_element = document.createElement("p");
    content_element.appendChild(document.createTextNode(content));

    let source_element = document.createElement("h4");
    source_element.appendChild(document.createTextNode(source + ':'));

    let message_element = document.createElement("div");
    message_element.setAttribute('class', 'any_message ' + category + '_message');
    message_element.appendChild(source_element);
    message_element.appendChild(content_element);
    message_display.append(message_element);
    message_display.scrollTop = message_display.scrollHeight;
}

function create_chat_window(x, y)
{
    var chat_window = create_window(x, y, 400, 600);
    chat_window.css("width", "400px");
    chat_window.css("height", "400px");

    var message_display = document.createElement("div");
    message_display.setAttribute('class', 'message_display');
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

    chat_window.register_event("chat message", function (message) {
        if (message.user == "Error")
        {
            create_message(message_display, "error", message.user, message.data);
        }
        else if (message.user == "System")
        {
            create_message(message_display, "system", message.user, message.data);
        }
        else
        {
            create_message(message_display, "received", message.user, message.data);
        }
    });

    return chat_window;
}

function create_button_window(x, y)
{
    var button_window = create_window(x, y, 600, 200);
    
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

var background_menu_function_map = {
    'Chat': create_chat_window,
    'Buttons': create_button_window,
    'Files': create_file_window,
    'Cancel': function(x, y) {}
};

// Main function
$("document").ready(function () {
    // Setup background doubleclick function
    $("#tabletop").dblclick(function (eventObject) {
        create_background_menu(eventObject.clientX, eventObject.clientY);
    });
});
