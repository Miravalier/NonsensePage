DROP TABLE IF EXISTS files;
CREATE TABLE files (
    file_name           text,
    file_type           text,
    owner_id            integer,
    permission_id       integer,
    parent_id           integer,
    file_id     serial  PRIMARY KEY
);
