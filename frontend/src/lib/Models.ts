export enum Alignment {
    Enemy = 0,
    Neutral = 1,
    Ally = 2,
    Player = 3,
}

export enum Language {
    Common = 0,
}

export enum Permission {
    Inherit = 0,
    None = 1,
    Read = 2,
    Write = 3,
    Owner = 4,
}

export enum AbilityType {
    Passive = 0,
    Free = 1,
    Action = 2,
    Reaction = 3
}

export enum RollType {
    Text = "text",
    Dice = "dice",
    Table = "table",
}

export enum ScaleType {
    Absolute = 0,
    Relative = 1,
}

export type PermissionTable = {
    [entityId: string]: {
        [field: string]: Permission;
    }
};

export interface Stat {
    id: string;
    name: string;
    value: number | string | boolean;
    min: number | null;
    max: number | null;
}

export interface Roll {
    type: RollType;
    label: string;
    formula: string;
}

export interface CharacterAbility {
    id: string;
    name: string;
    description: string;
    type: AbilityType;
    cooldown: number;
    rolls: Roll[];
}

export interface Entry {
    id: string;
    name: string;
    permissions: PermissionTable;
    data: any;
}

export interface Ability extends Entry {
    entry_type: "ability";
    description: string;
    type: AbilityType;
    cooldown: number;
    rolls: Roll[];
}

export interface User extends Entry {
    entry_type: "user";
    is_gm: boolean;
    character_id: string | null;
    languages: Language[];
}

export interface Message {
    entry_type: "message";
    id: string;
    sender_id: string;
    character_id: string;
    timestamp: number;
    language: Language;
    speaker: string;
    /** Mutually exclusive with length */
    content: string;
    /** Mutually exclusive with content */
    length: number;
}

export interface Entity extends Entry {
    stat_map: { [id: string]: Stat };
    stat_order: string[];
}

export interface Item extends Entity {
    entry_type: "item";
    description: string;
    item_map: { [id: string]: Item };
    item_order: string[];
}

export interface Character extends Entity {
    entry_type: "character";
    description: string;
    image: string;
    alignment: number;
    hp: number;
    max_hp: number;
    size: number;
    scale: number;
    sheet_type: string;
    item_map: { [id: string]: Item };
    item_order: string[];
    ability_map: { [id: string]: CharacterAbility };
    ability_order: string[];
    // Doesn't come over the wire, added before rendering
    // and used by Sqrl helpers
    helperData: any;
}

export interface Note extends Entry {
    entry_type: "note";
    image: string;
    text: string;
}

export interface Combatant extends Entry {
    entry_type: "combatant";
    character_id: string;
    initiative: number;
}

export interface Combat extends Entry {
    entry_type: "combat";
    combatants: Combatant[];
}
