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
