//ENTITY-SCHEMA
import * as Entity from "/res/dnd/entity.js?ver=ent-4";

export default class Equipment extends Entity.Entity {
    /* Method Overrides */
    //init()                  {}
    //on_viewer_open()        {}
    //on_map_select()         {}
    //on_map_drop(e)          {} // e: source_map, target_map
    //on_change_attribute(e)  {} // e: attr, old_value, new_value
}

/* Property Overrides */
Equipment.prototype.attributes = {
    "name": Entity.ATTR_STRING,
    "effect": Entity.ATTR_STRING
};

Equipment.prototype.layout = [
    {
        type: "row",
        children: [
            {
                type: "button",
                name: "Use",
                effect: function (weapon, character) {}
            },
            {type: "text attribute", name: "Name", key: "name"},
            {type: "text attribute", name: "Effect", key: "effect"}
        ]
    }
]
