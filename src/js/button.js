export function Button(className) {
    const button = document.createElement("div");
    button.className = "button";

    const icon = document.createElement("i");
    icon.classList = `fas ${className}`;
    button.appendChild(icon);

    return button;
}
