export function Html(html: string): HTMLElement {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.children.item(0) as HTMLElement;
}


export function Button(name: string, style: string = "solid"): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.appendChild(Icon(name, style));
    return button;
}


export function Icon(name: string, style: string = "solid"): HTMLElement {
    if (style === undefined) {
        style = "solid";
    }
    const icon = document.createElement("i");
    icon.className = `fa-${style} fa-${name} button`;
    return icon;
}
