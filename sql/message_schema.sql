DROP TABLE IF EXISTS messages;
CREATE TABLE messages (
    sender_id           integer,
    permission_id       integer,
    category            text,
    display_name        text,
    content             text,
    sent_time           timestamp,
    message_id serial   PRIMARY KEY
);
