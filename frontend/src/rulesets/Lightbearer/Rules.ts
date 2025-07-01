import { classDescriptions, raceDescriptions, classMaxHp, raceImageAuthors } from "./Creator";


export async function LightbearerRulesRender(container: HTMLDivElement) {
    const raceContainer: HTMLDivElement = container.querySelector(".races");
    const classContainer: HTMLDivElement = container.querySelector(".classes");

    for (const [race, raceDescription] of Object.entries(raceDescriptions)) {
        const raceElement = raceContainer.appendChild(document.createElement("div"));
        raceElement.classList.add("race");

        const raceHeader = raceElement.appendChild(document.createElement("h2"));
        raceHeader.textContent = race;

        raceElement.appendChild(document.createElement("p")).innerHTML = `<i>${classDescriptions[race]}</i>`;
        for (const [key, value] of Object.entries(raceDescription)) {
            raceElement.appendChild(document.createElement("p")).innerHTML = `<b>${key}</b>: ${value}`;
        }

        const raceImage = raceElement.appendChild(document.createElement("img"));
        raceImage.classList.add("race-portrait");
        raceImage.src = `/RaceImages/${race}.jpg`;

        raceElement.appendChild(document.createElement("p")).innerHTML = `<i>Art by: ${raceImageAuthors[race]}</i>`;
    }

    for (const className of Object.keys(classMaxHp) ) {
        const classElement = classContainer.appendChild(document.createElement("div"));
        classElement.classList.add("class");

        const classHeader = classElement.appendChild(document.createElement("h2"));
        classHeader.textContent = className;

        classElement.appendChild(document.createElement("p")).innerHTML = `<i>${classDescriptions[className]}</i>`;
    }
}
