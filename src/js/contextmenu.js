import { Html } from "./elements.js";

// Globals
let contextMenuElement = null;
let contextMenuResolve = null;


export function init() {
    document.addEventListener("click", () => {
        if (contextMenuElement !== null) {
            contextMenuElement.remove();
            contextMenuElement = null;
            contextMenuResolve([null, null]);
        }
    });
}

/**
 * @param {HTMLDivElement} element
 * @param {string[]} options
 * @param {(ev: MouseEvent, choice: string) => void} callback
 */
export function set(element, options) {
    element.addEventListener("contextmenu", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();

        if (contextMenuElement !== null) {
            contextMenuElement.remove();
            contextMenuElement = null;
            contextMenuResolve([null, null]);
        }

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

        contextMenuElement = Html(`
            <div class="contextMenu" style="left: ${ev.clientX}px; top: ${ev.clientY}px;">
                ${categoryDivs.join("")}
            </div>
        `);
        document.body.appendChild(contextMenuElement);

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
