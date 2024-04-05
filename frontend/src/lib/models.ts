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
