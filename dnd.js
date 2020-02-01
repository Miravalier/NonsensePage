import * as utils from "./utils.js?ver=util-0";

// Mutable Globals
var g_open_windows = new Set();
var g_focus = true;
var g_notification_sent = false;
var g_commands = {
    '': [
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

    let args = utils.string_to_args(string);
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
            let args = utils.string_to_args(message);

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

function confirm_dialog(prompt, callback)
{
    let dialog_element = $(`<div title="Confirm">
        ${prompt}
    </div>`);
    $("#tabletop").append(dialog_element);
    dialog_element.dialog({
        resizable: false,
        height: "auto",
        width: 400,
        modal: true,
        buttons: {
            Confirm: function() {
                callback();
                $(this).dialog("close");
            },
            Cancel: function() {
                $(this).dialog("close");
            }
        }
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
                    console.log(`Sending file part (${j+1}/${chunks.length}) of ${files[i].name}`);
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

function query_dialog(title, prompt, callback)
{
    let dialog_element = $(`<div title="${title}">
        ${prompt}
        <input type="text" class="name"></input>
    </div>`);
    $("#tabletop").append(dialog_element);
    dialog_element.dialog({
        resizable: false,
        height: "auto",
        width: 400,
        modal: true,
        buttons: {
            Confirm: function() {
                let value = dialog_element.find("input.name").val().trim();
                if (value) {
                    callback(value);
                }
                $(this).dialog("close");
            }
        }
    });
    dialog_element.on("keydown", function(e) {
        if (e.key == "Enter") {
            let value = dialog_element.find("input.name").val().trim();
            if (value) {
                callback(value);
            }
            $(this).dialog("close");
        }
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

function create_message(message_display, category, timestamp, source, content)
{
    if (timestamp) {
        var message = $(`
            <div class="any_message ${category}_message">
                <h5>${utils.strftime(timestamp)}</h5><h4>${source}:</h4><p>${content}</p>
            </div>
        `);
    }
    else {
        var message = $(`
            <div class="any_message ${category}_message">
                <h4>${source}:</h4><p>${content}</p>
            </div>
        `);
    }
    message_display.append(message);
    message_display.scrollTop(message_display.prop('scrollHeight'));
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
    chat_window.append(message_display);
    chat_window.message_display = message_display

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

    chat_window.message_set = new Set();

    register_message("clear history", function (message) {
        chat_window.message_set.clear();
        message_display.html("");
    });

    register_message("chat message", function (message) {
        if (message.id != -1 && chat_window.message_set.has(message.id)) {
            // Discard messages we've already received unless
            // their id is -1 (internal)
            return;
        }
        chat_window.message_set.add(message.id);
        if (!message.historical) {
            notify(`${message['display name']}: ${message.text}`);
        }

        if (message.category == "Error") {
            create_message(message_display, "error", message.timestamp, "Error", message.text);
        }
        else if (message.category == "System") {
            create_message(message_display, "system", message.timestamp, "System", message.text);
        }
        else {
            create_message(message_display, "received", message.timestamp, message["display name"], message.text);
        }
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

function create_text_viewer(x, y, width, height, file)
{
    if (!x) x = 0;
    if (!y) y = 0;
    if (!width) width = 400;
    if (!height) height = 400;
    let text_window = create_window(x, y, width, height);
    text_window.window_type = "text viewer";
    text_window.options[file.name] = {
        'Download': function () {
            on_reply(
                {type: "download file", id: file.id},
                function (reply) {
                    save_file(file.name, "octet/stream", reply.data);
                }
            );
        }
    };
    text_window.append($(`<div class="text_viewport">
        <pre class="opened_text no_drag">${file.content}</pre>
    </div>`));
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
        'Download': function () {
            on_reply(
                {type: "download file", id: file.id},
                function (reply) {
                    save_file(file.name, "octet/stream", reply.data);
                }
            );
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

    register_message("files updated", function () {
        load_file_listing(file_window);
    });

    file_window.options['Files'] = {
        'Add Subfolder': function () {
            query_dialog("Add Subfolder", "Name:", function(value) {
                send_object({type: "add subfolder", id: file_window.pwd_id, name: value});
            });
        },
        'Upload File': function () {
            upload_file_dialog(file_window);
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


function on_reply(request, callback) {
    let request_id = Math.floor(Math.random()*4294967295);
    request["request id"] = request_id;
    g_waiting_requests[request_id] = [request, callback];
    send_object(request);
}


function load_file_listing(file_window) {
    on_reply(
        {type: "ls", id: file_window.pwd_id},
        (function (reply) {
            file_window.viewport.empty();
            // Add parent node return (back button)
            if (file_window.pwd_id != 0)
            {
                let button = $(`
                    <div class="directory file_button no_drag">
                        <img width=24px height=24px src="/res/dnd/icons/back.svg"></img>
                        <p>Back</p>
                    </div>
                `);
                button.dblclick(function (e) {
                    on_reply(
                        {type: "get parent", id: file_window.pwd_id},
                        (subreply) => {
                            file_window.pwd_id = subreply.parent;
                            load_file_listing(file_window);
                        }
                    );
                });
                button.droppable({
                    drop: (e, ui) => {
                        on_reply(
                            {type: "get parent", id: file_window.pwd_id},
                            (subreply) => {
                                send_object({
                                    type: "move file",
                                    id: ui.draggable.data("fileid"),
                                    destination: subreply.parent
                                });
                            }
                        );
                    }
                });
                file_window.viewport.prepend(button);

            }
            // Add child nodes
            reply.nodes.forEach(node => {
                let [filename, fileid, filetype] = node;
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
                button.dblclick(function (e) {
                    if (filetype == 'directory') {
                        file_window.pwd_id = fileid
                        load_file_listing(file_window);
                    }
                    else if (filetype == 'raw') {
                        on_reply(
                            {type: "download file", id: fileid},
                            function (reply) {
                                save_file(filename, "octet/stream", reply.data);
                            }
                        );
                    }
                    else {
                        on_reply(
                            {type: "open file", id: fileid},
                            function (reply) {
                                if (reply.type == "img") {
                                    var view_creator = create_image_viewer;
                                }
                                else if (reply.type == "txt") {
                                    var view_creator = create_text_viewer;
                                }
                                else {
                                    console.log(`No viewer to open file ${reply.type}`);
                                    return;
                                }
                                let file = {
                                    name: filename,
                                    id: fileid,
                                    type: filetype
                                };
                                Object.assign(file, reply);
                                view_creator(e.clientX, e.clientY, 400, 400, file)
                            }
                        );
                    }
                });
                button.draggable({
                    cursorAt: { top: 0, left: 0 },
                    helper: "clone"
                });
                button.on("contextmenu", function (e) {
                    let file_menu = {};
                    file_menu[filename] = {
                            'Download': (function () {
                                on_reply(
                                    {type: "download file", id: fileid},
                                    function (reply) {
                                        save_file(filename, "octet/stream", reply.data);
                                    }
                                );
                            }),
                            'Rename': (function () {
                                query_dialog(
                                    `Rename ${filename}`,
                                    "Name:",
                                    (value) => {
                                        send_object({
                                            type: "rename file",
                                            id: fileid,
                                            name: value
                                        });
                                    }
                                );
                            }),
                            'Delete': () => {
                                confirm_dialog(
                                    `Are you sure you want to delete ${filename}?
                                    This cannot be undone.`,
                                    () => {
                                        send_object({
                                            type: "delete file",
                                            id: fileid
                                        });
                                    }
                                );
                            }
                    };
                    create_context_menu(e.clientX, e.clientY, file_menu);
                    e.preventDefault();
                    e.stopPropagation();
                });
                file_window.viewport.append(button);
            });
        })
    );
}


function save_file(name, type, data) {
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
        e.stopPropagation();
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

    register_message("prompt username", message => {
        query_dialog(
            "Select Username",
            "Username:",
            function(value) {
                send_object({type: "update username", name: value});
            }
        );
    });

    register_message("directory listing", () => {});

    load_layout();
});
