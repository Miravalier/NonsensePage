DROP TABLE IF EXISTS users;
CREATE TABLE users (
    google_id   text,
    user_name   text,
    admin       boolean,
    user_id serial PRIMARY KEY
);
