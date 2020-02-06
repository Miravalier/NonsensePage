import * as Entity from "./entity.js?ver=ent-2";
import * as Utils from "./utils.js?ver=util-2";
import * as Dice from "./dice.js?ver=dice-1";

// Mutable Globals
var g_open_windows = new Set();
var g_focus = true;
var g_notification_sent = false;
var g_layout_elements = {};
var g_commands = {
    '/roll': [
        [["formula", s => s]],
        function (args) {
            send_object({
                type: "chat message",
                text: Dice.roll(args[1]).toString()
            });
        }
    ],
    '/clear': [
        [],
        function (args) {
            send_object({"type": "clear history"});
        }
    ],
    '/theme': [
        [["fantasy | tech | icy", s => s]],
        function (args) {
            $("#background").attr("class", args[1]);
            $("#watermark").attr("class", args[1]);
            system_message(`'${args[1]}' theme applied.`);
        }
    ]
};

// Constant Globals
const g_history_limit = 512;

const g_notification_options = {
    badge: "/res/dnd/dnd.ico"
};

const g_window_type_map = {
    "button": create_button_window,
    "file": create_file_window,
    "chat": create_chat_window
};

function param_usage(params, start_index)
{
    if (start_index) {
        return params.slice(start_index-1).map(p => `<${p[0]}>`).join(" ")
    }
    else {
        return params.map(p => `<${p[0]}>`).join(" ")
    }
}

function window_autocomplete(window_element)
{
    window_element.tab_complete = null;
    if (window_element.text_input.value[0] !== '/') {
        window_element.suggestion.setAttribute("placeholder", "");
        return;
    }
    let string = window_element.text_input.value.trim();

    let args = Utils.string_to_args(string);
    let cmd = args[0];
    let options = Object.keys(g_commands).filter(o=>o.startsWith(cmd));
    if (options.length == 1) {
        let match = options[0];
        let [params, callback] = g_commands[match];
        if (cmd != match) {
            window_element.tab_complete = match.substr(string.length, match.length)
            window_element.suggestion.setAttribute(
                "placeholder", " ".repeat(string.length) + window_element.tab_complete
            );
        }
        else if (args.length - 1 < params.length) {
            window_element.suggestion.setAttribute(
                "placeholder",
                " ".repeat(string.length + 1) + param_usage(params, args.length)
            );
        }
        else if (args.length - 1 > params.length) {
            window_element.suggestion.setAttribute(
                "placeholder",
                " ".repeat(string.length + 1) + "!"
            );
        }
        else {
            window_element.suggestion.setAttribute(
                "placeholder",
                ""
            );
        }
    }
    else if (options.length == 0) {
        window_element.suggestion.setAttribute(
            "placeholder",
            " ".repeat(string.length + 1) + "!"
        );
    }
    else {
        window_element.suggestion.setAttribute("placeholder", "");
    }
}

function window_execute_command(window_element)
{
    let message = window_element.text_input.value;
    if (message.length > 1024)
    {
        error_message("Your message is too long.");
        return;
    }
    else if (message[0] == '/')
    {
        try {
            let args = Utils.string_to_args(message);

            let command = args[0];
            if (!(command in g_commands)) {
                throw new TypeError(`'${command}' is not a real command.`);
            }

            let [params, callback] = g_commands[command];
            if (args.length != params.length+1) {
                throw new TypeError(`usage: ${command} ${param_usage(params)}`);
            }

            for (let i=0; i < params.length; i++) {
                try {
                    args[i+1] = params[i][1](args[i+1]);
                }
                catch (e) {
                    throw new TypeError(`Invalid parameter '${args[i+1]}'.\nusage: ${command} ${param_usage(params)}`);
                }
            }

            callback(args);
        }
        catch (e) {
            error_message(e.message);
        }
    }
    else
    {
        send_object({type: "chat message", text: message});
    }

    window_element.text_input.value = "";
    window_element.suggestion.placeholder = "";
}


function set_cookie(key, value, persist)
{
    let cookie_string = `${key}=${value}; path=/`;

    if (persist)
    {
        let cookie_date = new Date();
        cookie_date.setFullYear(cookie_date.getFullYear() + 10);
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


function error_message(text) {
    local_object({
        type: "chat message",
        category: "Error",
        "display name": "Error",
        text: text,
        id: -1
    });
}


function system_message(text) {
    local_object({
        type: "chat message",
        category: "System",
        "display name": "System",
        text: text,
        id: -1
    });
}


function create_context_menu(x, y, options)
{
    $("#g_context_menu").remove();

    let menu_html = "";
    Object.keys(options).forEach(function (category_name) {
        let category = options[category_name]
        menu_html += `<li class="ui-state-disabled unselectable"><div>${category_name}</div></li>`;
        Object.keys(category).forEach(function (option_name) {
            menu_html += `<li data-category="${category_name}"><div class="unselectable">${option_name}</div></li>`;
        });
    });

    // Create menu html
    var context_menu = $(`<ul id="g_context_menu">${menu_html}</ul>`);

    // Append html to DOM
    $("#tabletop").append(context_menu);

    // Create menu widget
    context_menu.menu({
        select: function (eventObject, ui) {
            let category = ui.item.data("category");
            let option = ui.item.text();
            let callback = options[category][option];
            if (callback) {
                callback(x, y);
            }
            context_menu.remove();
        }
    });

    context_menu.css({"left": x, "top": y});
    return context_menu;
}

function confirm_dialog(prompt)
{
    let dialog_element = $(`<div title="Confirm">
        ${prompt}
    </div>`);
    $("#tabletop").append(dialog_element);
    return new Promise((resolve, reject) => {
        dialog_element.dialog({
            resizable: false,
            height: "auto",
            width: 400,
            modal: true,
            buttons: {
                Confirm: function() {
                    resolve(true);
                    $(this).dialog("close");
                },
                Cancel: function() {
                    resolve(false);
                    $(this).dialog("close");
                }
            },
            close: function() {
                resolve(false);
            }
        });
    });
}

function upload_file_dialog(file_window)
{
    let dialog_element = $(`<div title="Upload Files">
        <input type="file" class="file"></input>
    </div>`);
    $("#tabletop").append(dialog_element);
    let confirm_function = (function () {
        let files = dialog_element.find("input.file").prop('files')
        for (let i=0; i < files.length; i++) {
            files[i].arrayBuffer().then(buffer => {
                // Stop large files before getting a servor error
                // reply for the client's convenience only
                if (files[i].size > 5242880) {
                    console.error("File too large to send");
                    return;
                }

                let request_id = Math.floor(Math.random()*4294967295);

                // Split the file into chunks
                let chunks = [];
                for (let bytes_chunked = 0; bytes_chunked < files[i].size;) {
                    // Calculate the size of the next chunk
                    let chunk_size = Math.min(32768, files[i].size - bytes_chunked);
                    // Generate a view of the chunk body
                    let chunk = new Uint8Array(buffer, bytes_chunked, chunk_size);
                    // Genereate a chunk header
                    let chunk_header = new ArrayBuffer(8);
                    let header_view = new DataView(chunk_header);
                    header_view.setUint32(0, request_id);
                    header_view.setUint32(4, chunks.length);
                    // Concatenate the header to the body and queue it for sending
                    let blob = new Blob([chunk_header, chunk], {type: "octet/stream"});
                    chunks.push(blob);
                    bytes_chunked += chunk_size;
                }

                console.log(`Sending file ${files[i].name}`);

                // Send the file initiation message
                send_object({
                    type: "upload file",
                    id: file_window.pwd_id,
                    name: files[i].name,
                    "request id": request_id,
                    "chunk count": chunks.length
                });

                // Send each chunk
                for (let j=0; j < chunks.length; j++) {
                    send_raw(chunks[j]);
                }
            });
        }
        dialog_element.dialog("close");
    });
    dialog_element.dialog({
        resizable: false,
        height: "auto",
        width: 400,
        modal: true,
        buttons: {
            Confirm: confirm_function
        }
    });
    dialog_element.on("keydown", function(e) {
        if (e.key == "Enter") {
            confirm_function();
        }
    });
}


async function create_entity_dialog()
{
    let reply = await send_request({type: "list schema"});
    if (reply.schemas.length > 0) {
        let schemas = reply.schemas.map(file => `
            <option value="${file[0]}">${file[1]}</option>
        `).join("");
        var dialog_element = $(`
            <div title="Create Entity">
                Schema: <select class="entity_schema">${schemas}</select>
                <br>
                Name: <input type="text" class="name"></input>
            </div>
        `);
    }
    else {
        var dialog_element = $(`
            <div title="Create Entity">
                Error: No Entity Schemas
            </div>
        `);
    }

    $("#tabletop").append(dialog_element);
    return new Promise((resolve, reject) => {
        let confirm_function = function() {
            try {
                let name = dialog_element.find("input.name").val().trim();
                let schema = parseInt(dialog_element.find("select.entity_schema").val());
                if (name && schema) {
                    resolve([name, schema]);
                }
                else {
                    resolve([null, null]);
                }
            }
            catch (e) {
                resolve([null, null]);
            }
            dialog_element.dialog("close");
        }
        dialog_element.dialog({
            resizable: false,
            height: "auto",
            width: 400,
            modal: true,
            buttons: {
                Confirm: confirm_function
            },
            close: function() {
                resolve([null, null]);
            }
        });
        dialog_element.on("keydown", function(e) {
            if (e.key == "Enter") confirm_function();
        });
    });
}


function create_file_dialog()
{
    let dialog_element = $(`<div title="Create File">
        Type:
        <select class="file_type">
            <option value="txt">Text</option>
            <option value="token">Token</option>
            <option value="map">Map</option>
            <option value="entity schema">Entity Schema</option>
        </select>
        <br>
        Name:
        <input type="text" class="name"></input>
    </div>`);
    $("#tabletop").append(dialog_element);
    return new Promise((resolve, reject) => {
        let confirm_function = function() {
            let name = dialog_element.find("input.name").val().trim();
            let file_type = dialog_element.find("select.file_type").val();
            if (name && file_type)
                resolve([name, file_type]);
            else
                resolve([null, null]);
            dialog_element.dialog("close");
        }
        dialog_element.dialog({
            resizable: false,
            height: "auto",
            width: 400,
            modal: true,
            buttons: {
                Confirm: confirm_function
            },
            close: function() {
                resolve([null, null]);
            }
        });
        dialog_element.on("keydown", function(e) {
            if (e.key == "Enter") confirm_function();
        });
    });
}


function query_dialog(title, prompt)
{
    let dialog_element = $(`<div title="${title}">
        ${prompt}
        <input type="text" class="name"></input>
    </div>`);
    $("#tabletop").append(dialog_element);
    return new Promise((resolve, reject) => {
        dialog_element.dialog({
            resizable: false,
            height: "auto",
            width: 400,
            modal: true,
            buttons: {
                Confirm: function() {
                    let value = dialog_element.find("input.name").val().trim();
                    if (value) {
                        resolve(value);
                    }
                    else {
                        resolve(null);
                    }
                    $(this).dialog("close");
                }
            },
            close: function() {
                resolve(null);
            }
        });
        dialog_element.on("keydown", function(e) {
            if (e.key == "Enter") {
                let value = dialog_element.find("input.name").val().trim();
                if (value) {
                    resolve(value);
                }
                else {
                    resolve(null);
                }
                $(this).dialog("close");
            }
        });
    });
}


function create_window(x, y, width, height)
{
    let window_element = $(`
        <div class="dnd_window" style="width: ${width}px; height: ${height}px; left: ${x}px; top: ${y}px; position: absolute;"></div>
    `);
    g_open_windows.add(window_element);
    window_element.draggable({
        containment: "parent",
        snap: ".dnd_window",
        cancel: ".no_drag",
        drag: function (e) {
            for (let open_window of g_open_windows) {
                open_window.css("zIndex", 0);
            }
            window_element.css("zIndex", 1);
        }
    });
    window_element.resizable({
        containment: "parent",
        handles: 'all'
    });
    window_element.remove_handlers = [];

    window_element.options = {
        "UI": {
            "Close": function() {
                g_open_windows.delete(window_element);
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

function create_message(message_display, sender, id, category, timestamp, source, content)
{
    if (message_display.message_count >= g_history_limit) {
        let removed_message = message_display.head_message;
        message_display.head_message = removed_message.next;
        message_display.head_message.previous = null;
        removed_message.remove();
        message_display.message_count--;
    }

    if (timestamp) {
        var message = $(`
            <div class="any_message ${category}_message">
                <h5>${Utils.strftime(timestamp)}</h5><h4>${source}:</h4><p>${content}</p>
            </div>
        `);
    }
    else {
        var message = $(`
            <div class="any_message ${category}_message">
                <h5></h5><h4>${source}:</h4><p>${content}</p>
            </div>
        `);
    }

    message_display.append(message);
    message_display.scrollTop(message_display.prop('scrollHeight'));
    if (message.id != -1) {
        if (message_display.head_message == null) {
            message_display.head_message = message;
        }
        message.previous = message_display.tail_message;
        message.next = null;
        message_display.tail_message = message;

        if (message.previous != null) {
            message.previous.next = message;
        }
    }

    let options = {};

    if (g_id == sender) {
        options["Message"] = {
            "Delete": function () {
                return;
            },
            "Edit": function () {
                return;
            }
        };
    }
    else if (g_admin) {
        options["Message"] = {
            "Delete": function () {
                return;
            },
            "Edit": function () {
                return;
            },
            "Move Up": function () {
                if (!message.previous) {
                    return;
                }
                send_object({type: "swap messages", ids: [message.message_id, message.previous.message_id]});
            },
            "Move Down": function () {
                if (!message.next) {
                    return;
                }
                send_object({type: "swap messages", ids: [message.message_id, message.next.message_id]});
            }
        };
    }

    message.message_id = id;
    message.on("contextmenu", function (e) {
        create_context_menu(e.clientX, e.clientY, options);
        e.preventDefault();
        e.stopPropagation();
    });

    return message;
}

function swap_messages(a, b) {
    let a_h5 = a.find("h5");
    let a_h4 = a.find("h4");
    let a_p = a.find("p");
    let b_h5 = b.find("h5");
    let b_h4 = b.find("h4");
    let b_p = b.find("p");

    var temp = a_h5.text();
    a_h5.text(b_h5.text());
    b_h5.text(temp);

    temp = a_h4.text();
    a_h4.text(b_h4.text());
    b_h4.text(temp);

    temp = a_p.text();
    a_p.text(b_p.text());
    b_p.text(temp);
}

function create_chat_window(x, y, width, height)
{
    if (!x) x = 0;
    if (!y) y = 0;
    if (!width) width = 400
    if (!height) height = 400;
    let chat_window = create_window(x, y, width, height);
    chat_window.window_type = "chat";
    chat_window.tab_complete = null;
    let drag_handle = $('<div class="drag_handle"></div>');
    chat_window.append(drag_handle);

    let message_display = $('<div class="message_display no_drag"></div>')
    message_display.message_count = 0;
    message_display.tail_message = null;
    message_display.head_message = null;
    chat_window.append(message_display);
    chat_window.message_display = message_display;

    let text_input = document.createElement("input");
    chat_window.text_input = text_input;
    let suggestion = document.createElement("input");
    chat_window.suggestion = suggestion;

    text_input.setAttribute('class', 'message_input no_drag');
    text_input.setAttribute('type', 'text');
    text_input.setAttribute('name', 'message');
    text_input.setAttribute('autocomplete', 'off');
    text_input.addEventListener('keydown', function (e) {
        if (e.key == "Enter") {
            window_execute_command(chat_window);
            e.preventDefault();
        }
        else if (e.key == "Tab") {
            if (chat_window.tab_complete) {
                text_input.value += chat_window.tab_complete;
                chat_window.tab_complete = null;
                window_autocomplete(chat_window);
            }
            e.preventDefault();
        }
    });

    text_input.addEventListener('input', function (e) {
        window_autocomplete(chat_window);
    });

    text_input.addEventListener('click', function (e) {
        text_input.focus();
    })

    suggestion.setAttribute('class', 'message_suggestion no_drag');
    suggestion.setAttribute('type', 'text');
    suggestion.setAttribute('autocomplete', 'off');
    suggestion.setAttribute('readonly', true);

    chat_window.append(suggestion);
    chat_window.append(text_input);

    message_display.messages = {};

    register_message("message edit", function (message) {
        let a = message_display.messages[message.id];
        if (!a) {
            return;
        }
        if (message.timestamp) {
            let timestamp = Utils.strftime(message.timestamp);
            a.find("h5").text(timestamp);
        }
        a.find("h4").text(message.source);
        a.find("p").text(message.content);
    });

    register_message("swap messages", function (message) {
        let a = message_display.messages[message.ids[0]];
        let b = message_display.messages[message.ids[1]];
        if (a && b) {
            swap_messages(a, b);
        }
    });

    register_message("clear history", function (message) {
        message_display.message_count = 0;
        message_display.messages = {};
        message_display.tail_message = null;
        message_display.head_message = null;
        message_display.html("");
    });

    register_message("chat message", function (message) {
        if (!message.historical) {
            notify(`${message['display name']}: ${message.text}`);
        }

        if (message.category == "Error") {
            var element = create_message(
                message_display, message.sender, -1,
                "error", message.timestamp, "Error", message.text
            );
        }
        else if (message.category == "System") {
            var element = create_message(
                message_display, message.sender, -1,
                "system", message.timestamp, "System", message.text
            );
        }
        else {
            var element = create_message(
                message_display, message.sender, message.id,
                "received", message.timestamp, message["display name"], message.text
            );
            message_display.message_count++;
        }
        message_display.messages[message.id] = element;
    });

    send_object({"type": "request history"});

    return chat_window;
}

function create_button_window(x, y, width, height, buttons)
{
    if (!x) x = 0;
    if (!y) y = 0;
    if (!width) width = 300;
    if (!height) height = 64;
    if (!buttons) buttons = [];

    let button_window = create_window(x, y, width, height);
    button_window.window_type = "button";
    button_window.buttons = buttons;
    let button_display = $(`<div class="button_display"></div>`);
    button_window.options['Button Tray'] = {
        'Add Button': (function () {
            button_display.append(
                $(`<img class="window_button" src="/res/dnd/button.svg"></img>`)
            );
        })
    };

    button_window.append(button_display);
    button_window.button_display = button_display;
    return button_window;
}

// LAYOUT ELEMENTS

g_layout_elements["row section"] = async function (viewer, entity, element) {
    let section = $(`<div class="row_section"></div>`);
    if (element.title) {
        section.append($(`<h3 class="section_title">${element.title}</h3>`));
    }
    for (let subelement of element.children) {
        section.append(await create_layout_element(viewer, entity, subelement));
    }
    return section;
};

g_layout_elements["column section"] = async function (viewer, entity, element) {
    let section = $(`<div class="column_section"></div>`);
    if (element.title) {
        section.append($(`<h3 class="section_title">${element.title}</h3>`));
    }
    for (let subelement of element.children) {
        section.append(await create_layout_element(viewer, entity, subelement));
    }
    return section;
};

g_layout_elements["row"] = async function (viewer, entity, element) {
    let section = $(`<div class="row"></div>`);
    if (element.title) {
        section.append($(`<h3 class="section_title">${element.title}</h3>`));
    }
    for (let subelement of element.children) {
        section.append(await create_layout_element(viewer, entity, subelement));
    }
    return section;
};

g_layout_elements["column"] = async function (viewer, entity, element) {
    let section = $(`<div class="column"></div>`);
    if (element.title) {
        section.append($(`<h3 class="section_title">${element.title}</h3>`));
    }
    for (let subelement of element.children) {
        section.append(await create_layout_element(viewer, entity, subelement));
    }
    return section;
};

g_layout_elements["boolean attribute"] = async function (viewer, entity, element) {
    let value = await entity.get_attr(element.key);
    let attribute = $(`<div class="attribute no_drag"></div>`);
    if (element.name) {
        attribute.append($(`<h4 class="label">${element.name}</h4>`));
    }
    if (value) {
        attribute.append($(`<input class="boolean" type="checkbox" value="1" checked></input>`));
    }
    else {
        attribute.append($(`<input class="boolean" type="checkbox" value="1"></input>`));
    }
    let input = attribute.find("input");
    input.on("input", function () {
        entity.set_attr(element.key, input.val());
    });
    return attribute;
};

g_layout_elements["text attribute"] = async function (viewer, entity, element) {
    let value = await entity.get_attr(element.key);
    let attribute = $(`<div class="attribute no_drag"></div>`);
    if (element.name) {
        attribute.append($(`<h4 class="label">${element.name}</h4>`));
    }
    attribute.append($(`<input class="text" type="text" value="${value}"></input>`));
    let input = attribute.find("input");
    input.on("input", function () {
        entity.set_attr(element.key, input.val());
    });
    return attribute;
};

g_layout_elements["formula attribute"] = async function (viewer, entity, element) {
    let value = await entity.get_attr(element.key);
    let attribute = $(`<div class="attribute no_drag"></div>`);
    if (element.name) {
        attribute.append($(`<h4 class="label">${element.name}</h4>`));
    }
    attribute.append($(`<input class="formula" type="text" value="${value}"></input>`));
    let input = attribute.find("input");
    input.on("input", function () {
        entity.set_attr(element.key, input.val());
    });
    return attribute;
};

g_layout_elements["number attribute"] = async function (viewer, entity, element) {
    let value = await entity.get_attr(element.key);
    let attribute = $(`<div class="attribute no_drag"></div>`);
    if (element.name) {
        attribute.append($(`<h4 class="label">${element.name}</h4>`));
    }
    attribute.append($(`<input class="numeric" type="number" value="${value}"></input>`));
    let input = attribute.find("input");
    input.on("input", function () {
        entity.set_attr(element.key, parseInt(input.val()));
    });
    return attribute;
};

g_layout_elements["entity attribute"] = async function (viewer, entity, element) {
    // Generate sub entity
    let sub_entity_id = await entity.get_attr(element.key);
    if (!sub_entity_id) {
        return;
    }
    let SubEntityType = await get_schema(sub_entity_id);
    let sub_entity = new SubEntityType(sub_entity_id);
    sub_entity.parent = entity;
    // Nest sub entity layout
    let div = $(`<div class="subentity no_drag"></div>`);
    for (let subelement of sub_entity.layout) {
        div.append(await create_layout_element(viewer, sub_entity, subelement));
    }
    return div;
};

g_layout_elements["entity array attribute"] = async function (viewer, entity, element) {
    let array_div = $(`<div class="viewer_array"></div>`);
    // Generate sub entity
    let sub_entity_ids = await entity.get_attr(element.key);
    if (!sub_entity_ids) {
        return;
    }
    for (let sub_entity_id of sub_entity_ids) {
        let div = $(`<div class="subentity no_drag"></div>`);
        let SubEntityType = await get_schema(sub_entity_id);
        let sub_entity = new SubEntityType(sub_entity_id);
        sub_entity.parent = entity;
        // Nest sub entity layout
        for (let subelement of sub_entity.layout) {
            div.append(await create_layout_element(viewer, sub_entity, subelement));
        }
        array_div.append(div);
    }
    return array_div;
};

g_layout_elements["button"] = async function (viewer, entity, element) {
    let button = $(`<button class="viewer_button no_drag" type="button"></button>`);
    if (element.name) {
        button.text(element.name);
    }
    if (element.effect) {
        button.on("click", (e) => {
            element.effect.call(entity, e);
        });
    }
    return button;
};

async function create_layout_element(viewer, entity, element) {
    let element_creator = g_layout_elements[element.type];
    if (element_creator) {
        return await element_creator(viewer, entity, element);
    }
    else {
        console.error(`Unrecognized viewer element type: '${element.type}'`);
    }
}

async function create_entity_viewer(x, y, width, height, file)
{
    if (!x) x = 0;
    if (!y) y = 0;
    if (!width) width = 400;
    if (!height) height = 400;

    let entity_viewer = create_window(x, y, width, height);
    entity_viewer.window_type = "entity viewer";
    let viewport = $(`<div class="entity_viewport"></div>`);
    entity_viewer.append(viewport);

    let EntityType = await get_schema(file.id);
    let entity = new EntityType(file.id);
    for (let element of entity.layout) {
        viewport.append(await create_layout_element(entity_viewer, entity, element));
    }

    return entity_viewer;
}


function create_entity_schema_viewer(x, y, width, height, file)
{
    let text_window = create_text_viewer(x, y, width, height, file);
    text_window.options[file.name] = {
        'Download': async function () {
            save_file_uuid(file.name + ".js", file.uuid);
        }
    };

    return text_window;
}


function create_text_viewer(x, y, width, height, file)
{
    if (!x) x = 0;
    if (!y) y = 0;
    if (!width) width = 400;
    if (!height) height = 400;
    let text_window = create_window(x, y, width, height);
    text_window.window_type = "text viewer";
    text_window.file = file;
    text_window.options[file.name] = {
        'Download': async function () {
            save_file_uuid(file.name + ".txt", file.uuid);
        }
    };

    let save_button = $(`
        <button type="button">
            <img height=24px width=24px src="/res/dnd/icons/save.svg"/>
        </button>
    `);
    save_button.on("click", function () {
        send_object({
            type: "update file",
            id: file.id,
            content: text_window.find("pre").text()
        });
    });
    text_window.append(save_button);
    text_window.append($(`
        <div class="text_viewport">
            <pre class="opened_text no_drag" contenteditable="true"></pre>
        </div>
    `));
    $.get(
        `/content/${file.uuid}`,
        {},
        (data) => {
            text_window.find("pre").text(data);
        },
        "text"
    );

    return text_window;
}

function create_image_viewer(x, y, width, height, file)
{
    if (!x) x = 0;
    if (!y) y = 0;
    if (!width) width = 400;
    if (!height) height = 400;
    let image_window = create_window(x, y, width, height);
    image_window.window_type = "image viewer";
    image_window.options[file.name] = {
        'Download': async function () {
            save_file_uuid(file.name, file.uuid);
        }
    };
    image_window.append($('<div class="drag_handle"></div>'));
    let image_viewport = $(`<div class="image_viewport">
        <img class="opened_image" src="/content/${file.uuid}"></img>
    </div>`);
    image_window.append(image_viewport);
    return image_window;
}

function create_file_window(x, y, width, height, pwd_id)
{
    if (!x) x = 0;
    if (!y) y = 0;
    if (!width) width = 400
    if (!height) height = 400;
    if (!pwd_id) pwd_id = 0;

    let file_window = create_window(x, y, width, height);
    file_window.window_type = "file";
    file_window.pwd_id = pwd_id;

    file_window.options['Files'] = {
        'Add Folder': async function () {
            let name = await query_dialog("Add Folder", "Name:");
            if (!name) {
                console.log("Canceled add subfolder.");
                return;
            }
            send_object({type: "add subfolder", id: file_window.pwd_id, name: name});
        },
        'Create File': async function () {
            let [name, type] = await create_file_dialog();
            if (!name || !type) {
                console.log("Canceled create file.");
                return;
            }
            send_object({type: "create file", id: file_window.pwd_id, name: name, filetype: type});
        },
        'Upload File': function () {
            upload_file_dialog(file_window);
        },
        'Create Entity': async function () {
            let [name, schema] = await create_entity_dialog();
            if (!name || !schema) {
                console.log("Canceled create entity.");
                return;
            }

            await spawn_entity(name, file_window.pwd_id, schema);
        }
    };

    let file_viewport = $(`
        <div class="file_viewport"></div>
    `);
    file_window.viewport = file_viewport;
    file_window.append(file_viewport);

    load_file_listing(file_window);

    return file_window;
}


async function spawn_entity(name, parent_id, schema) {
    // Create base entity
    let reply = await send_request({
        type: "create entity",
        id: parent_id,
        name: name,
        schema: schema
    });
    // Verify return
    if (reply.type == "error") {
        console.error(reply.reason);
        return;
    }
    // Get entity
    let entity_id = reply.id;
    let EntityType = await get_schema(entity_id);
    let entity = new EntityType(entity_id);
    // Initialize entity attributes
    send_object({type: "init attrs", entity: entity_id, attrs: entity.attributes});
    // Recursively spawn any non-array entity attributes
    for (let attr of Object.keys(entity.attributes)) {
        let type = entity.attributes[attr];
        if (typeof(type) != "number") {
            var [attr_type, attr_schema] = type;
        }
        else {
            var attr_type = type;
            var attr_schema = null;
        }
        if (((attr_type & Entity.ATTR_ARRAY) == 0) && attr_schema)
        {
            // Update parent with id of sub entity attribute
            let sub_entity_id = await spawn_entity(attr, entity_id, attr_schema);
            if (!sub_entity_id) {
                return;
            }
            entity.set_attr(attr, sub_entity_id);
        }
    }

    return entity_id;
}


var g_schemas = {};
async function get_schema(item) {
    if (item in g_schemas) {
        var module = g_schemas[item];
    }
    else {
        if (typeof(item) == "number") {
            var schema_reply = await send_request({type: "get schema", "entity id": item});
        }
        else {
            var schema_reply = await send_request({type: "get schema", "schema name": item});
        }
        var module = await import(`/content/${schema_reply.uuid}`);
        g_schemas[item] = module;
    }
    return module.default;
}


var g_view_creators = {
    "img": create_image_viewer,
    "txt": create_text_viewer,
    "entity schema": create_entity_schema_viewer,
    "entity": create_entity_viewer
};
async function load_file_listing(file_window) {
    file_window.viewport.empty();
    let reply = await send_request({type: "ls", id: file_window.pwd_id});
    // Add parent node return (back button)
    if (file_window.pwd_id != 0)
    {
        let button = $(`
            <div class="directory file_button no_drag">
                <img width=24px height=24px src="/res/dnd/icons/back.svg"></img>
                <p>Back</p>
            </div>
        `);
        file_window.viewport.prepend(button);
        button.dblclick(async function (e) {
            let subreply = await send_request({type: "get parent", id: file_window.pwd_id});
            file_window.pwd_id = subreply.parent;
            load_file_listing(file_window);
        });
        button.droppable({
            drop: (e, ui) => {
                send_request({type: "get parent", id: file_window.pwd_id}).then(subreply => {
                    send_object({
                        type: "move file",
                        id: ui.draggable.data("fileid"),
                        destination: subreply.parent
                    });
                });
            }
        });
    }
    // Add child nodes
    reply.nodes.forEach(node => {
        let [filename, fileid, filetype, fileuuid] = node;
        let button = $(`
            <div class="${filetype} file_button no_drag">
                <img width=24px height=24px src="/res/dnd/icons/${filetype}.svg"></img>
                <p>${filename}</p>
            </div>
        `);
        button.data("fileid", fileid);
        if (filetype == 'directory') {
            button.droppable({
                drop: (e, ui) => {
                    send_object({
                        type: "move file",
                        id: ui.draggable.data("fileid"),
                        destination: fileid
                    });
                }
            });
        }
        button.dblclick(async function (e) {
            if (filetype == 'directory') {
                file_window.pwd_id = fileid
                load_file_listing(file_window);
            }
            else if (filetype == 'raw') {
                save_file_uuid(filename, fileuuid);
            }
            else {
                let view_creator = g_view_creators[filetype];
                if (!view_creator) {
                    console.log(`No viewer to open '${filetype}' file`);
                    return;
                }
                view_creator(e.clientX, e.clientY, 400, 400, {
                    name: filename,
                    id: fileid,
                    type: filetype,
                    uuid: fileuuid
                });
            }
        });
        button.draggable({
            cursorAt: { top: 0, left: 0 },
            helper: "clone"
        });
        button.on("contextmenu", function (e) {
            let file_menu = {};
            file_menu[filename] = {
                'Download': function () {
                    save_file_uuid(filename, fileuuid);
                },
                'Rename': async function () {
                    let name = await query_dialog(`Rename ${filename}`, "Name:");
                    if (!name) {
                        console.log("Canceled rename.");
                        return;
                    }
                    send_object({
                        type: "rename file",
                        id: fileid,
                        name: name
                    });
                },
                'Delete': async function () {
                    let prompt = `Are you sure you want to delete ${filename}? This cannot be undone.`;
                    if (!(await confirm_dialog(prompt))) {
                        console.log("Canceled file delete.");
                        return;
                    }
                    send_object({type: "delete file", id: fileid});
                }
            };
            create_context_menu(e.clientX, e.clientY, file_menu);
            e.preventDefault();
            e.stopPropagation();
        });
        file_window.viewport.append(button);
    });
}


function save_file_uuid(name, uuid) {
    let a = document.createElement("a");
    document.body.appendChild(a);

    a.style = "display: none";
    a.href = `/content/${uuid}`;
    a.download = name;

    a.click();

    document.body.removeChild(a);
}


function save_file_blob(name, type, data) {
    let blob = new Blob([data], {type: type});
    let a = document.createElement("a");
    document.body.appendChild(a);
    let url = window.URL.createObjectURL(blob);

    a.style = "display: none";
    a.href = url;
    a.download = name;

    a.click();

    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
};


function save_layout() {
    let saved_windows = [];
    for (let open_window of g_open_windows) {
        let s_data = [
            open_window.window_type,
            parseFloat(open_window.css("left")),
            parseFloat(open_window.css("top")),
            parseFloat(open_window.css("width")),
            parseFloat(open_window.css("height"))
        ];
        if (open_window.window_type == "button") {
            s_data.push(open_window.buttons);
        }
        else if (open_window.window_type == "file") {
            s_data.push(open_window.pwd_id);
        }
        else if (open_window.window_type == "chat") {
            s_data.push('');
        }
        else {
            return;
        }
        saved_windows.push(s_data);
    }
    set_cookie("saved_layout", btoa(JSON.stringify(saved_windows)), true);
}


function load_layout() {
    try {
        var saved_windows = JSON.parse(atob(get_cookie("saved_layout")));
    }
    catch (e) {
        return;
    }

    for (let open_window of g_open_windows) {
        open_window.remove_handlers.forEach(handler => {handler();});
        open_window.remove();
    }
    g_open_windows.clear();

    for (let saved_window of saved_windows) {
        let [window_type, s_left, s_top, s_width, s_height, s_data] = saved_window;

        let window_creator = g_window_type_map[window_type];
        if (!window_creator)
            continue;

        var window_element = window_creator(s_left, s_top, s_width, s_height, s_data);
    }
}


function notify(message) {
    // Only send if another tab is selected and
    // no notifications have been sent yet.
    if (g_focus || g_notification_sent) {
        return;
    }

    if (!("Notification" in window)) {
        console.error("Notification silenced, no browser support.");
    }
    else if (Notification.permission == "granted") {
        var notification = new Notification(message, g_notification_options);
    }
    else if (Notification.permission != "denied") {
        Notification.requestPermission().then(function (permission) {
            if (permission == "granted") {
                var notification = new Notification(message, g_notification_options);
            }
        });
    }
}


// Main function
$("document").ready(function () {
    var g_version = $("meta[name='version']").attr('content');
    console.log("TOWNHALL v"+g_version);
    let tabletop = $("#tabletop");
    tabletop.on("click", function (e) {
        $("#g_context_menu").remove();
        //e.stopPropagation();
    });
    tabletop.on("contextmenu", function (e) {
        create_context_menu(e.clientX, e.clientY, {
            'New Window': {
                'Chat': create_chat_window,
                'Button Tray': create_button_window,
                'File Explorer': create_file_window,
            },
            'UI': {
                // [[type, left, top, width, height, data]]
                'Save Layout': save_layout,
                'Load Layout': load_layout,
                'Cancel': () => {}
            }
        });
        e.preventDefault();
        e.stopPropagation();
    });

    $(window).on("blur", function () {
        g_focus = false;
    });
    $(window).on("focus", function () {
        g_focus = true;
        g_notification_sent = false;
    });
    if (!("Notification" in window)) {
        console.error("Notification silenced, no browser support.");
    }
    else if (Notification.permission != "granted") {
        Notification.requestPermission();
    }

    register_message("history reply", message => {
        let messages = message.messages;
        for (let i=messages.length-1; i >= 0; i--) {
            let [message_id, sender_id, category, display_name, content, timestamp] = messages[i];
            local_object({
                type: "chat message",
                "category": category,
                "text": content,
                "id": message_id,
                "display name": display_name,
                "timestamp": timestamp,
                "historical": true
            });
        }
    });

    register_message("prompt username", async function (message) {
        let username = await query_dialog("Select Username", "Username:");
        if (!username) {
            console.log("Canceled username selection.");
            return;
        }
        send_object({type: "update username", name: username});
    });

    register_message("directory listing", () => {});
    register_message("no reply", () => {});
    register_message("success", () => {});

    register_message("update file", async function (message) {
        let file_id = message["file id"];
        for (let open_window of g_open_windows) {
            if (open_window.window_type == "file") {
                if (open_window.pwd_id != file_id) {
                    return;
                }
                load_file_listing(open_window);
            }
            else if (open_window.window_type == "text viewer")
            {
                if (open_window.file.id != file_id) {
                    return;
                }
                $.get(
                    `/content/${open_window.file.uuid}`,
                    {},
                    (data) => {
                        open_window.find("pre").text(data);
                    },
                    "text"
                );
            }
        }
    });

    load_layout();
});
