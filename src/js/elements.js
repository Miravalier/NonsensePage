/**
 * @param {string} html
 * @returns Element
 */
export function Html(html) {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.children.item(0);
}


export function Button(name, style) {
    const button = document.createElement("button");
    button.type = "button";
    button.appendChild(Icon(name, style));
    return button;
}


export function Icon(name, style) {
    if (style === undefined) {
        style = "solid";
    }
    const icon = document.createElement("i");
    icon.classList = `fa-${style} fa-${name} button`;
    return icon;
}
