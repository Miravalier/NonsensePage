export enum Alignment {
    Enemy = 0,
    Neutral = 1,
    Ally = 2,
    Player = 3,
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

export interface Ability {
    id: string;
    name: string;
    description: string;
    type: AbilityType;
    cooldown: number;
}

export interface Entry {
    id: string;
    name: string;
    permissions: PermissionTable;
    data: any;
}

export interface Entity extends Entry {
    stat_map: { [id: string]: Stat };
    stat_order: string[];
}

export interface Item extends Entity {
    type: "item";
    description: string;
    item_map: { [id: string]: Item };
    item_order: string[];
}

export interface Character extends Entity {
    type: "character";
    description: string;
    image: string;
    alignment: string;
    hp: number;
    max_hp: number;
    size: number;
    scale: number;
    sheet_type: string;
    item_map: { [id: string]: Item };
    item_order: string[];
    ability_map: { [id: string]: Ability };
    ability_order: string[];
    // Doesn't come over the wire, added before rendering
    // and used by Sqrl helpers
    helperData: any;
}

export interface Combatant extends Entry {
    type: "combatant";
    character_id: string;
    initiative: number;
}

export interface Combat extends Entry {
    type: "combat";
    combatants: Combatant[];
}
