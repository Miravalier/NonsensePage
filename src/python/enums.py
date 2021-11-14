from enum import Enum, IntEnum

import strawberry


class Permissions(IntEnum):
    NONE = 0
    READ = 1
    WRITE = 2
    OWNER = 3


@strawberry.enum
class Alignment(Enum):
    NONE = 0
    ENEMY = 1
    NEUTRAL = 2
    ALLY = 3
