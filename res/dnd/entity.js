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
    }

    /* For use in abstract methods */
    async get_attr(name) {
        if (this.entity_id not in g_cache) {
            g_cache[this.entity_id] = {};
        }

        if (name in g_cache[this.entity_id]) {
            return g_cache[this.entity_id][name];
        }

        if (!(name in this.attributes)) {
            throw new Error("Nonexistent attribute: " + name);
        }
        let reply = await send_request({
            type: "get attr",
            entity: this.entity_id,
            attr: [name, this.attributes[name]]
        });
        if (reply.type == "error") {
            console.error(reply.reason);
            return null;
        }
        else {
            g_cache[this.entity_id][name] = reply.result;
            return reply.result
        }
    }

    set_attr(name, value) {
        if (this.entity_id not in g_cache) {
            g_cache[this.entity_id] = {};
        }
        send_object({
            type: "set attr",
            entity: this.entity_id,
            attr: [name, this.attributes[name], value]
        });
        g_cache[this.entity_id][name] = value;
    }

    set_attrs(options) {
        if (this.entity_id not in g_cache) {
            g_cache[this.entity_id] = {};
        }
        let attributes = [];
        for (let name of Object.keys(options)) {
            // Name, Type, Value
            attributes.push([name, this.attributes[name], options[name]]);
            g_cache[this.entity_id][name] = options[name];
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
Entity.prototype.layout = [];
