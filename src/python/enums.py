from enum import IntEnum


class Permissions(IntEnum):
    INHERIT = 0
    NONE = 1
    READ = 2
    WRITE = 3
    OWNER = 4


class Alignment(IntEnum):
    ENEMY = 0
    NEUTRAL = 1
    ALLY = 2
    PLAYER = 3


class Language(IntEnum):
    COMMON = 0
