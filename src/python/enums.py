from enum import Enum, IntEnum


class Permissions(IntEnum):
    NONE = 0
    READ = 1
    WRITE = 2
    OWNER = 3


class Alignment(Enum):
    NONE = 0
    ENEMY = 1
    NEUTRAL = 2
    ALLY = 3


class Language(IntEnum):
    COMMON = 0
