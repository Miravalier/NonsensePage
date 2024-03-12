enum Permission {
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

export interface Entry {
    id: string;
    name: string;
    permissions: PermissionTable;
    data: any;
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
