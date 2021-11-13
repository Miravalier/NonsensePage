import enum


class Permissions(enum.IntEnum):
    NONE = 0
    READ = 1
    WRITE = 2
    OWNER = 3
