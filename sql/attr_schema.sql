DROP TABLE IF EXISTS numeric_attrs;
CREATE TABLE numeric_attrs (
    entity_id   integer,
    attr_name   text,
    attr_value  numeric,
    attr_id     serial  PRIMARY KEY
);

DROP TABLE IF EXISTS string_attrs;
CREATE TABLE string_attrs (
    entity_id   integer,
    attr_name   text,
    attr_value  text,
    attr_id     serial  PRIMARY KEY
);

DROP TABLE IF EXISTS entity_attrs;
CREATE TABLE entity_attrs (
    entity_id   integer,
    attr_name   text,
    attr_value  integer,
    attr_id     serial  PRIMARY KEY
);
