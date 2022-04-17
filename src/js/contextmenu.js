import { Require } from "./utils.js";


export function ContextMenu(options) {
    options = Require(options);
    const position = Require(options.position);
    const title = Require(options.title);
    const choices = Require(options.choices);

    const container = document.createElement("div");
    container.className = "contextMenu";

    const titleElement = container.appendChild(document.createElement("div"));
    titleElement.className = "title";
    titleElement.appendChild(document.createTextNode(title));

    const choiceContainer = container.appendChild(document.createElement("div"));
    choiceContainer.className = "choices";

    for (let choice of Object.keys(choices)) {
        const choiceElement = choiceContainer.appendChild(document.createElement("div"));
        choiceElement.className = "choice";
        choiceElement.appendChild(document.createTextNode(choice));
        choiceElement.addEventListener("click", ev => {
            ev.preventDefault();
            ev.stopPropagation();
            const callback = choices[choice];
            callback();
            container.remove();
        });
    }

    container.style.left = position.x;
    container.style.top = position.y;

    document.body.appendChild(container);
    return container;
}
