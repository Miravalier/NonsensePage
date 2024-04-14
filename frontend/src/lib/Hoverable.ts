export function set(hoveredElement: HTMLElement, hoveringElement: HTMLElement) {
    hoveringElement.style.display = "none";
    hoveringElement.style.position = "absolute";
    document.body.appendChild(hoveringElement);

    hoveredElement.addEventListener("mouseenter", (ev) => {
        hoveringElement.style.display = null;

        const moveHoveringElement = (ev: MouseEvent) => {
            hoveringElement.style.top = ev.clientY - hoveringElement.clientHeight + "px";
            hoveringElement.style.left = ev.clientX - (hoveringElement.clientWidth / 2) + "px";
        };

        moveHoveringElement(ev);
        hoveredElement.addEventListener("mousemove", moveHoveringElement);

        hoveredElement.addEventListener("mouseleave", () => {
            hoveringElement.style.display = "none";
            hoveredElement.removeEventListener("mousemove", moveHoveringElement);
        }, { once: true });
    });
}
