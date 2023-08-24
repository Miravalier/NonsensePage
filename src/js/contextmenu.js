import { Html } from "./elements.js";

// Globals
let contextMenuElement = null;
let contextMenuResolve = null;


export function close() {
    if (contextMenuElement !== null) {
        contextMenuElement.remove();
        contextMenuElement = null;
        contextMenuResolve([null, null]);
    }
}


export async function init() {
    document.addEventListener("click", () => {
        close();
    });
}


/**
 * @param {HTMLDivElement} element
 * @param {object} options
 */
export function set(element, options) {
    element.addEventListener("contextmenu", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();

        close();

        const callbacks = {};
        const categoryDivs = [];
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

        // Create the menu offscreen for better UX
        contextMenuElement = Html(`
            <div class="contextMenu" style="left: -999px; top: -999px;">
                ${categoryDivs.join("")}
            </div>
        `);
        document.body.appendChild(contextMenuElement);

        const rect = contextMenuElement.getBoundingClientRect();
        const flip_threshold = 0.7;
        let left = ev.clientX;
        let top = ev.clientY;

        if (left > (flip_threshold * window.innerWidth)) {
            left -= rect.width;
        }

        if (top > (flip_threshold * window.innerHeight)) {
            top -= rect.height;
        }

        // Move the menu to the correct spot
        contextMenuElement.style.left = `${left}px`;
        contextMenuElement.style.top = `${top}px`;

        for (let choiceElement of contextMenuElement.querySelectorAll(".choice")) {
            choiceElement.addEventListener("click", ev => {
                ev.preventDefault();
                ev.stopPropagation();
                contextMenuElement.remove();
                contextMenuElement = null;
                contextMenuResolve([ev, choiceElement.dataset.choice]);
            });
        }

        const [resolvingEvent, selectedOption] = await new Promise((resolve) => {
            contextMenuResolve = resolve;
        });
        if (selectedOption) {
            callbacks[selectedOption](resolvingEvent);
        }
    });
}
