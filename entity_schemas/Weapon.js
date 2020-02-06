//ENTITY-SCHEMA
import * as Entity from "/res/dnd/entity.js?ver=ent-3";

export default class Weapon extends Entity.Entity {
    /* Method Overrides */
    //init()                  {}
    //on_viewer_open()        {}
    //on_map_select()         {}
    //on_map_drop(e)          {} // e: source_map, target_map
    //on_change_attribute(e)  {} // e: attr, old_value, new_value
}

/* Property Overrides */
Weapon.prototype.attributes = {
    "ranged": Entity.ATTR_NUMBER,
    "name": Entity.ATTR_STRING,
    "damage": Entity.ATTR_STRING,
    "accuracy": Entity.ATTR_NUMBER,
    "heat": Entity.ATTR_NUMBER,
    "piercing": Entity.ATTR_NUMBER,
    "range dc": Entity.ATTR_NUMBER
};

Weapon.prototype.layout = [
    {
        type: "row",
        children: [
            {type: "boolean attribute", name: "Ranged", key: "ranged"},
            {type: "text attribute", name: "Name", key: "name"},
            {type: "formula attribute", name: "Damage", key: "damage"},
            {type: "number attribute", name: "Accuracy", key: "accuracy"},
            {type: "number attribute", name: "Heat", key: "heat"},
            {type: "number attribute", name: "Piercing", key: "piercing"},
            {type: "number attribute", name: "Range DC", key: "range dc"}
        ]
    }
]
