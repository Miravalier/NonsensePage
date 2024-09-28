import { Bound } from "./Utils.ts";

export function set(hoveredElement: HTMLElement, hoveringElement: HTMLElement) {
    hoveringElement.style.display = "none";
    hoveringElement.style.position = "fixed";
    hoveredElement.appendChild(hoveringElement);

    hoveredElement.addEventListener("mouseenter", (ev) => {
        hoveringElement.style.display = null;
        const eventBoundingRect = hoveredElement.getBoundingClientRect();

        const moveHoveringElement = (ev: MouseEvent) => {
            if (ev.clientX < eventBoundingRect.left
                || ev.clientX > eventBoundingRect.right
                || ev.clientY < eventBoundingRect.top
                || ev.clientY > eventBoundingRect.bottom) {
                return;
            }
            const top = Bound(0, ev.clientY - hoveringElement.clientHeight, window.innerHeight - hoveringElement.clientHeight);
            const left = Bound(0, ev.clientX - (hoveringElement.clientWidth / 2), window.innerWidth - hoveringElement.clientWidth);
            hoveringElement.style.top = top + "px";
            hoveringElement.style.left = left + "px";
        };

        moveHoveringElement(ev);
        hoveredElement.addEventListener("mousemove", moveHoveringElement);

        hoveredElement.addEventListener("mouseleave", () => {
            hoveringElement.style.display = "none";
            hoveredElement.removeEventListener("mousemove", moveHoveringElement);
        }, { once: true });
    });
}
