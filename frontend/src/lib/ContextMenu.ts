import { Future } from "./Async.ts";
import { Html } from "./Elements.ts";

// Globals
let contextMenuElement: HTMLDivElement = null;
let contextMenuFuture: Future<[MouseEvent, string]> = null;


export function close() {
    if (contextMenuElement !== null) {
        contextMenuElement.remove();
        contextMenuElement = null;
        contextMenuFuture.resolve([null, null]);
    }
}


export async function init() {
    document.addEventListener("click", () => {
        close();
    });
}


export function set(element: HTMLElement, options: { [category: string]: { [choice: string]: (ev: MouseEvent) => void } }): AbortController {
    const abortController = new AbortController();
    element.addEventListener("contextmenu", async (ev: MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        close();
        if (options == null) {
            return;
        }
        contextMenuFuture = new Future();

        const callbacks: { [choice: string]: (ev: MouseEvent) => void } = {};
        const categoryDivs: string[] = [];
        for (const [category, suboptions] of Object.entries(options)) {
            const optionDivs = [];
            for (const [choice, callback] of Object.entries(suboptions)) {
                optionDivs.push(`<div class="choice" data-choice="${category}.${choice}">${choice}</div>`);
                callbacks[`${category}.${choice}`] = callback;
            }
            categoryDivs.push(`
                <div class="title">${category}</div>
                <div class="choices">
                    ${optionDivs.join("")}
                </div>
            `);
        }

        const flip_threshold = 0.7;
        let horizontal = "left";
        let vertical = "top";
        let xOffset = ev.clientX;
        let yOffset = ev.clientY;

        if (xOffset > (flip_threshold * window.innerWidth)) {
            xOffset = window.innerWidth - xOffset;
            horizontal = "right";
        }

        if (yOffset > (flip_threshold * window.innerHeight)) {
            yOffset = window.innerHeight - yOffset;
            vertical = "bottom";
        }

        contextMenuElement = Html(`
            <div class="contextMenu" style="${horizontal}: ${xOffset}px; ${vertical}: ${yOffset}px;">
                ${categoryDivs.join("")}
            </div>
        `) as HTMLDivElement;
        document.body.appendChild(contextMenuElement);

        for (let choiceElement of contextMenuElement.querySelectorAll<HTMLDivElement>(".choice")) {
            choiceElement.addEventListener("click", ev => {
                ev.preventDefault();
                ev.stopPropagation();
                contextMenuFuture.resolve([ev, choiceElement.dataset.choice]);
                contextMenuElement.remove();
                contextMenuElement = null;
            });
        }

        const [resolvingEvent, selectedOption] = await contextMenuFuture;
        if (selectedOption) {
            callbacks[selectedOption](resolvingEvent);
        }
    }, { signal: abortController.signal });
    return abortController;
}
