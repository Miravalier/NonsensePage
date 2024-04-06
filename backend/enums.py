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


class Layer(IntEnum):
    BACKGROUND = 0
    DETAILS = 1
    CHARACTERS = 2
    EFFECTS = 3


class GridColor(IntEnum):
    NONE = 0
    WHITE = 1
    BLACK = 2


class AbilityType(IntEnum):
    PASSIVE = 0
    FREE = 1
    ACTION = 2
    REACTION = 3
