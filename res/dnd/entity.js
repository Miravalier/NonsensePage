export const ATTR_NUMBER =  0b000;
export const ATTR_STRING =  0b001;
export const ATTR_ENTITY =  0b010;
export const ATTR_UNUSED =  0b011;
export const ATTR_TYPE   =  0b011;
export const ATTR_ARRAY  =  0b100;


export class Entity {
    /* Internal Use */
    constructor(entity_id) {
        this.entity_id = entity_id;
        console.log(`Constructing ${this.constructor.name} with id ${this.entity_id}`);
    }

    /* For use in abstract methods */
    get_attrs(attrs, callback) {
        let attributes = [];
        for (let name of attrs) {
            // Name, Type
            attributes.push(name, this.attributes[name]);
        }
        on_reply(
            {
                type: "get attrs",
                entity: this.entity_id,
                attrs: attributes
            },
            callback
        );
    }

    set_attrs(options) {
        let attributes = [];
        for (let name of Object.keys(options)) {
            // Name, Value, Type
            attributes.push([name, options[name], this.attributes[name]]);
        }
        send_object({
            type: "set attrs",
            entity: this.entity_id,
            attrs: attributes
        });
    }

    /* Abstract methods */
    init()                  {}
    on_viewer_open()        {}
    on_map_select()         {}
    on_map_drop(e)          {} // e: source_map, target_map
    on_change_attribute(e)  {} // e: attr, old_value, new_value
}

/* Abstract Properties */
Entity.prototype.attributes = {};
