import { CharacterAbility, AbilityType, Ability } from "../../lib/Models.ts";
import { ErrorToast } from "../../lib/Notifications.ts";
import { ApiRequest } from "../../lib/Requests.ts";
import { BaseWindow } from "../../windows/Window.ts";
import { GetAbilityIcons } from "./Utils.ts";
import { Html } from "../../lib/Elements.ts";
import { AddDescriptionListeners, RenderDescription } from "../../lib/Utils.ts";


export const raceImageAuthors = {
    "Aarakocra": "@jaesmart",
    "Centaur": "@krimspyke",
    "Dragonborn": "@sygdom",
    "Dwarf": "@nightsadesnk",
    "Elf": "@sylvkey",
    "Gnome": "@moonyeah",
    "Goliath": "@stadnikds",
    "Halfling": "@ditsyashley",
    "Human": "@alesart",
    "Orc": "@amrglt",
    "Satyr": "@natbat626",
    "Tabaxi": "@meraven",
    "Tiefling": "@rosietheillustrator",
    "Triton": "@lionysart",
    "Warforged": "@creaperbox",
}


export const classMaxHp = {
    "Assassin": 18,
    "Bard": 20,
    "Berserker": 22,
    "Cleric": 21,
    "Druid": 20,
    "Elementalist": 19,
    "Guardian": 25,
    "Necromancer": 21,
}


export const classAttributes = {
    // Classes
    "Assassin": { "agility": 5, "perception": 2, "charisma": -2, "endurance": -2, "strength": -2 },
    "Bard": { "charisma": 5, "memory": 5, "perception": -2, "agility": -1, "endurance": -3, "strength": -3 },
    "Berserker": { "strength": 5, "endurance": 4, "agility": 3, "charisma": -5, "memory": -3, "perception": -3 },
    "Cleric": { "charisma": 4, "endurance": 3, "agility": -2, "perception": -2, "strength": -2 },
    "Druid": { "memory": 4, "perception": 2, "charisma": -2, "agility": -1, "strength": -1, "endurance": -1 },
    "Elementalist": { "memory": 5, "charisma": -1, "strength": -1, "endurance": -1, "agility": -1 },
    "Guardian": { "endurance": 6, "charisma": 1, "agility": -1, "memory": -1, "perception": -2, "strength": -2 },
    "Necromancer": { "memory": 6, "charisma": -5 },
    // Races
    "Aarakocra": { "agility": 3, "perception": 3, "endurance": -2, "memory": -2, "charisma": -1 },
    "Centaur": { "strength": 2, "endurance": 4, "agility": -3, "perception": -2 },
    "Dragonborn": { "strength": 4, "endurance": 2, "agility": -3, "memory": -1, "charisma": -1 },
    "Dwarf": { "endurance": 4, "agility": -2, "perception": -1 },
    "Elf": { "agility": 3, "perception": 2, "memory": 2, "strength": -3, "endurance": -3 },
    "Gnome": { "memory": 6, "charisma": 4, "agility": 1, "strength": -5, "endurance": -5 },
    "Goliath": { "endurance": 6, "strength": 6, "memory": -4, "charisma": -4, "agility": -3 },
    "Halfling": { "agility": 2, "charisma": 2, "strength": -2, "endurance": -1 },
    "Human": {},
    "Orc": { "strength": 2, "agility": 2, "endurance": 2, "memory": -2, "perception": -2, "charisma": -1 },
    "Satyr": { "memory": 4, "agility": 2, "strength": -2, "endurance": -2, "perception": -1 },
    "Tabaxi": { "agility": 6, "perception": 3, "strength": -2, "endurance": -4, "memory": -2 },
    "Tiefling": { "strength": 3, "memory": 3, "charisma": -4, "agility": -1 },
    "Triton": { "perception": 2, "agility": 2, "memory": 2, "strength": -3, "endurance": -2 },
    "Warforged": { "strength": 3, "endurance": 3, "memory": 3, "perception": -4, "charisma": -4 },
};

export const classSkills = {
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
    "Elf": ["ranged", "ranged"],
    "Gnome": ["artifice", "artifice"],
    "Goliath": ["melee"],
    "Halfling": ["stealth", "stealth"],
    "Human": ["artifice"],
    "Orc": ["melee", "melee"],
    "Satyr": ["spellwork"],
    "Tabaxi": ["stealth"],
    "Tiefling": ["spellwork", "spellwork"],
    "Triton": ["tracking"],
    "Warforged": ["melee"],
};

export const classDescriptions = {
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
    "Tabaxi": "Nimble and cat-like",
    "Tiefling": "Cunning half-demon",
    "Triton": "Amphibious with natural electricity",
    "Warforged": "Automaton created by war mages",
};

export const raceDescriptions = {
    "Aarakocra": {
        "Height": "4'10\" - 5'5\"",
        "Weight": "80 - 100 lbs",
        "Lifespan": "40 yrs",
    },
    "Centaur": {
        "Height": "6' - 7'\"",
        "Weight": "400 - 800 lbs",
        "Lifespan": "80 yrs",
    },
    "Dragonborn": {
        "Height": "5'10\" - 6'6\"",
        "Weight": "200-300 lbs",
        "Lifespan": "300 yrs",
    },
    "Dwarf": {
        "Height": "4' - 5'2\"",
        "Weight": "150 - 250 lbs",
        "Lifespan": "500 yrs",
    },
    "Elf": {
        "Height": "5' - 6'3\"",
        "Weight": "90 - 150 lbs",
        "Lifespan": "Immortal",
    },
    "Gnome": {
        "Height": "3'6\" - 4'4\"",
        "Weight": "50 - 75 lbs",
        "Lifespan": "300 yrs",
    },
    "Goliath": {
        "Height": "7' - 9'",
        "Weight": "400 - 700 lbs",
        "Lifespan": "150 yrs",
    },
    "Halfling": {
        "Height": "3'10\" - 4'11\"",
        "Weight": "80 - 120 lbs",
        "Lifespan": "60 yrs",
    },
    "Human": {
        "Height": "5'2\" - 6'4\"",
        "Weight": "100 - 220 lbs",
        "Lifespan": "80 yrs",
    },
    "Orc": {
        "Height": "6' - 7'",
        "Weight": "280 - 400 lbs",
        "Lifespan": "80 yrs",
    },
    "Satyr": {
        "Height": "4'8\" - 5'10\"",
        "Weight": "90 - 175 lbs",
        "Lifespan": "60 yrs",
    },
    "Tabaxi": {
        "Height": "5'2\" - 5'10\"",
        "Weight": "100 - 150 lbs",
        "Lifespan": "70 yrs",
    },
    "Tiefling": {
        "Height": "5'2\" - 6'4\"",
        "Weight": "120 - 250 lbs",
        "Lifespan": "250 yrs",
    },
    "Triton": {
        "Height": "5'2\" - 5'10\"",
        "Weight": "110 - 175 lbs",
        "Lifespan": "1000 yrs",
    },
    "Warforged": {
        "Height": "4'0\" - 7'0\"",
        "Weight": "400-600 lbs",
        "Lifespan": "Immortal",
    },
}


function RenderAbility(ability: Ability): HTMLDivElement {
    const abilityElement = document.createElement("div");
    abilityElement.className = "ability";
    abilityElement.innerHTML = `
        <div class="bar">
            <div class="row">
                <div class="icons"></div>
                <div class="name">${ability.name}</div>
            </div>
        </div>
        <div class="details">
            <div class="description">${RenderDescription(ability.description)}</div>
        </div>
    `;
    AddDescriptionListeners(abilityElement);
    if (ability.type == AbilityType.Passive) {
        abilityElement.querySelector(".name").classList.add("passive");
    }
    abilityElement.querySelector(".icons").innerHTML = GetAbilityIcons(ability);
    return abilityElement;
}


export async function LightbearerCreatorRender(container: HTMLDivElement, data: { window: BaseWindow }) {
    const classSelect = container.querySelector<HTMLSelectElement>(".class");
    const raceSelect = container.querySelector<HTMLSelectElement>(".race");
    const classDescription = container.querySelector<HTMLDivElement>(".class-description");
    const raceDescription = container.querySelector<HTMLDivElement>(".race-description");
    const raceImage = container.querySelector<HTMLImageElement>(".race-image");
    const classAbilityContainer = container.querySelector<HTMLDivElement>(".class-abilities");
    const raceAbilityContainer = container.querySelector<HTMLDivElement>(".race-abilities");
    const weaponAbilityContainer = container.querySelector<HTMLDivElement>(".weapon-ability");
    const nameInput = container.querySelector<HTMLInputElement>(".characterName");
    const finishButton = container.querySelector<HTMLButtonElement>(".finish");
    const weaponSelect = document.createElement("select");
    weaponSelect.classList.add("weapon");

    const abilityCount = 3;

    let selectedAbilities: Ability[] = [];
    let racialAbilities: Ability[] = [];
    let basicAbilities: Ability[] = [];
    let weaponAbilities: Ability[] = [];
    let weaponData: { [name: string]: Ability } = {};

    const basicResponse: {
        status: string,
        name: string,
        parent_id: string,
        subfolders: [string, string][],
        entries: Ability[],
    } = await ApiRequest("/folder/ability/list", { folder_id: "Lightbearer.BasicActions" });

    basicAbilities = basicResponse.entries;

    const weaponResponse: {
        status: string,
        name: string,
        parent_id: string,
        subfolders: [string, string][],
        entries: Ability[],
    } = await ApiRequest("/folder/ability/list", { folder_id: "Lightbearer.Weapons" });

    for (const ability of weaponResponse.entries) {
        weaponData[ability.name] = ability;
        weaponSelect.appendChild(Html(`<option value="${ability.name}">${ability.name}</option>`));
    }

    const SelectWeapon = async (weaponName: string) => {
        const ability = weaponData[weaponName];
        weaponAbilities = [];
        weaponAbilityContainer.innerHTML = "";

        const abilityElement = RenderAbility(ability);
        abilityElement.classList.add("selected");

        const weaponNameElement = abilityElement.querySelector(".name");
        weaponNameElement.innerHTML = "";
        weaponNameElement.appendChild(weaponSelect);

        weaponAbilityContainer.appendChild(abilityElement);
        weaponAbilities.push(ability);
    }

    const SelectClass = async (className: string) => {
        classAbilityContainer.innerHTML = "";
        selectedAbilities = [];
        classDescription.innerText = classDescriptions[className];

        const response: {
            status: string,
            name: string,
            parent_id: string,
            subfolders: [string, string][],
            entries: Ability[],
        } = await ApiRequest("/folder/ability/list", { folder_id: `Lightbearer.Classes.${className}` });

        if (response.status !== "success") {
            ErrorToast(`Failed to load class: ${className}`);
            return;
        }

        for (const ability of response.entries) {
            if (ability.name.endsWith("+")) {
                continue;
            }
            const abilityElement = RenderAbility(ability);
            abilityElement.addEventListener("click", () => {
                if (abilityElement.classList.contains("selected")) {
                    selectedAbilities.splice(selectedAbilities.indexOf(ability), 1);
                }
                else {
                    if (selectedAbilities.length >= abilityCount) {
                        return;
                    }
                    selectedAbilities.push(ability);
                }
                abilityElement.classList.toggle("selected");
            });
            classAbilityContainer.appendChild(abilityElement);
        }
    };

    const SelectRace = async (race: string) => {
        raceImage.src = `/RaceImages/${race}.jpg`;

        raceAbilityContainer.innerHTML = "";
        raceDescription.innerHTML = "";

        raceDescription.appendChild(document.createElement("p")).innerHTML = `<i>${classDescriptions[race]}</i>`;
        for (const [key, value] of Object.entries(raceDescriptions[race])) {
            raceDescription.appendChild(document.createElement("p")).innerHTML = `<b>${key}</b>: ${value}`;
        }

        raceDescription.appendChild(document.createElement("p")).innerHTML = `<i>Art by: ${raceImageAuthors[race]}</i>`;

        const response: {
            status: string,
            name: string,
            parent_id: string,
            subfolders: [string, string][],
            entries: Ability[],
        } = await ApiRequest("/folder/ability/list", { folder_id: `Lightbearer.Races.${race}` });

        if (response.status !== "success") {
            ErrorToast(`Failed to load race: ${race}`);
            return;
        }

        racialAbilities = [];
        for (const ability of response.entries) {
            const abilityElement = RenderAbility(ability);
            abilityElement.classList.add("selected");
            raceAbilityContainer.appendChild(abilityElement);
            racialAbilities.push(ability);
        }
    };

    SelectClass(classSelect.value);
    classSelect?.addEventListener("change", () => {
        SelectClass(classSelect.value);
    });

    SelectRace(raceSelect.value);
    raceSelect?.addEventListener("change", () => {
        SelectRace(raceSelect.value);
    });

    SelectWeapon(weaponSelect.value);
    weaponSelect?.addEventListener("change", () => {
        SelectWeapon(weaponSelect.value);
    });

    finishButton.addEventListener("click", async () => {
        if (selectedAbilities.length < abilityCount) {
            ErrorToast(`You must select ${abilityCount} abilities`);
            return;
        }

        if (!nameInput.value) {
            ErrorToast("You must input a name");
            return;
        }

        selectedAbilities.push(...basicAbilities);
        selectedAbilities.push(...racialAbilities);
        selectedAbilities.push(...weaponAbilities);

        const abilityMap: { [id: string]: CharacterAbility } = {};
        for (const ability of selectedAbilities) {
            abilityMap[ability.id] = ability;
        }
        const characterInfo = {
            name: nameInput.value,
            image: `/files/Lightbearer/${classSelect.value}.png`,
            hp: classMaxHp[classSelect.value],
            max_hp: classMaxHp[classSelect.value],
            data: {
                agility: 12,
                charisma: 12,
                endurance: 12,
                memory: 12,
                strength: 12,
                perception: 12,
                artifice: 12,
                spellwork: 12,
                tracking: 12,
                stealth: 12,
                melee: 12,
                ranged: 12,
            },
            ability_order: Object.keys(abilityMap),
            ability_map: abilityMap,
            description: `Race: ${raceSelect.value}\nClass: ${classSelect.value}`,
        };
        for (const [statName, value] of Object.entries(classAttributes[classSelect.value])) {
            characterInfo.data[statName] += value;
        }
        for (const [statName, value] of Object.entries(classAttributes[raceSelect.value])) {
            characterInfo.data[statName] += value;
        }
        for (const skill of classSkills[classSelect.value]) {
            characterInfo.data[skill] += 3;
        }
        for (const skill of classSkills[raceSelect.value]) {
            characterInfo.data[skill] += 3;
        }
        if (raceSelect.value == "Dwarf") {
            characterInfo.max_hp += 5;
            characterInfo.hp += 5;
        }

        await ApiRequest("/character/create", { document: characterInfo });

        data.window.close();
    });
}
