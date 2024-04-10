import { Character } from "../lib/models.ts";
import { ApiRequest } from "../lib/requests.ts";
import * as Fragments from "./fragment.ts";

const playableClasses = ["Assassin", "Bard", "Berserker", "Cleric", "Druid", "Elementalist", "Guardian", "Necromancer"];


const playableRaces = [
    "Aarakocra", "Centaur", "Dragonborn", "Dwarf", "Elf",
    "Gnome", "Goliath", "Halfling", "Human", "Orc", "Satyr",
    "Tabaxi", "Tiefling", "Triton", "Warforged"
];


const classAttributes = {
    // Classes
    "Assassin": { "agility": 5, "perception": 2, "charisma": -2, "endurance": -2, "power": -2 },
    "Bard": { "charisma": 5, "memory": 5, "perception": -2, "agility": -1, "endurance": -3, "power": -3 },
    "Berserker": { "power": 5, "endurance": 4, "agility": 3, "charisma": -5, "memory": -3, "perception": -3 },
    "Cleric": { "charisma": 4, "endurance": 3, "agility": -2, "perception": -2, "power": -2 },
    "Druid": { "memory": 4, "perception": 2, "charisma": -2, "agility": -1, "power": -1, "endurance": -1 },
    "Elementalist": { "memory": 5, "charisma": -1, "power": -1, "endurance": -1, "agility": -1 },
    "Guardian": { "endurance": 6, "charisma": 1, "agility": -1, "memory": -1, "perception": -2, "power": -2 },
    "Necromancer": { "memory": 6, "charisma": -5 },
    // Races
    "Aarakocra": { "agility": 3, "perception": 3, "endurance": -2, "memory": -2, "charisma": -1 },
    "Centaur": { "power": 2, "endurance": 4, "agility": -3, "perception": -2 },
    "Dragonborn": { "power": 4, "endurance": 2, "agility": -3, "memory": -1, "charisma": -1 },
    "Dwarf": { "endurance": 4, "agility": -2, "perception": -1 },
    "Elf": { "agility": 3, "perception": 2, "memory": 2, "power": -3, "endurance": -3 },
    "Gnome": { "memory": 6, "charisma": 4, "agility": 1, "power": -5, "endurance": -5 },
    "Goliath": { "endurance": 6, "power": 6, "memory": -4, "charisma": -4, "agility": -3 },
    "Halfling": { "agility": 2, "charisma": 2, "power": -2, "endurance": -1 },
    "Human": {},
    "Orc": { "power": 2, "agility": 2, "endurance": 2, "memory": -2, "perception": -2, "charisma": -1 },
    "Satyr": { "memory": 4, "agility": 2, "power": -2, "endurance": -2, "perception": -1 },
    "Tabaxi": { "agility": 6, "perception": 3, "power": -2, "endurance": -4, "memory": -2 },
    "Tiefling": { "power": 3, "memory": 3, "charisma": -4, "agility": -1 },
    "Triton": { "perception": 2, "agility": 2, "memory": 2, "power": -3, "endurance": -2 },
    "Warforged": { "power": 3, "endurance": 3, "memory": 3, "perception": -4, "charisma": -4 },
};

const classSkills = {
    // Classes
    "Assassin": ["stealth", "melee"],
    "Bard": ["spellwork"],
    "Berserker": ["melee"],
    "Cleric": ["spellwork"],
    "Druid": ["spellwork", "tracking"],
    "Elementalist": ["spellwork"],
    "Guardian": ["melee"],
    "Necromancer": ["spellwork"],
    // Races
    "Aarakocra": ["tracking"],
    "Centaur": ["ranged"],
    "Dragonborn": ["melee"],
    "Dwarf": ["artifice"],
    "Elf": ["ranged"],
    "Gnome": ["spellwork"],
    "Goliath": ["melee"],
    "Halfling": ["stealth"],
    "Human": ["artifice"],
    "Orc": ["melee", "melee"],
    "Satyr": ["spellwork"],
    "Tabaxi": ["stealth"],
    "Tiefling": ["spellwork"],
    "Triton": ["tracking"],
    "Warforged": ["melee"],
};

const classDescriptions = {
    // Classes
    "Assassin": "Stealthy, melee, single-target damage dealer",
    "Bard": "Team-oriented with large AoE buffs and debuffs",
    "Berserker": "Frontline brute with risky abilities",
    "Cleric": "Healer and ranged support",
    "Druid": "Shapeshifting jack of all trades",
    "Elementalist": "High-damage ranged powerhouse",
    "Guardian": "Melee tank that keeps allies out of danger",
    "Necromancer": "Undead-summoning ranged support",
    // Races
    "Aarakocra": "Agile and capable of flight",
    "Centaur": "Fast and tough",
    "Dragonborn": "Scaled and breathes fire",
    "Dwarf": "Short and sturdy",
    "Elf": "Agile and perceptive",
    "Gnome": "Small and weak, but intelligent",
    "Goliath": "Massive and strong",
    "Halfling": "Small and unassuming",
    "Human": "Adaptable",
    "Orc": "Athletic and resilient",
    "Satyr": "Intelligent and energetic",
    "Tabaxi": "Nimble feline humanoid",
    "Tiefling": "Cunning half-demon",
    "Triton": "Amphibious with natural electricity",
    "Warforged": "Automaton created by war mages",
};



export function LightbearerCreatorRender(container: HTMLDivElement, data: any) {
    const classSelect = container.querySelector<HTMLSelectElement>(".class");
    const raceSelect = container.querySelector<HTMLSelectElement>(".race");
    const classDescription = container.querySelector<HTMLDivElement>(".class-description");
    const raceDescription = container.querySelector<HTMLDivElement>(".race-description");
    const abilityContainer = container.querySelector<HTMLDivElement>(".abilities");
    const nameInput = container.querySelector<HTMLInputElement>(".characterName");
    const finishButton = container.querySelector<HTMLButtonElement>(".finish");

    const SelectClass = async (className: string) => {
        classDescription.innerText = classDescriptions[className];
        const response: {
            status: string;
            character: Character;
        } = await ApiRequest("/character/get", { name: className });
        for (const abilityId of response.character.ability_order) {
            const ability = response.character.ability_map[abilityId];
            const abilityElement = abilityContainer.appendChild(document.createElement("div"));
            Fragments.RenderFragment(abilityElement, "ability", ability);
        }
    };

    const SelectRace = (race: string) => {
        raceDescription.innerText = classDescriptions[race];
    };

    SelectClass(classSelect.value);
    classSelect?.addEventListener("change", () => {
        SelectClass(classSelect.value);
    });

    SelectRace(raceSelect.value);
    raceSelect?.addEventListener("change", () => {
        SelectRace(raceSelect.value);
    });
}
