import os
import string
from contextlib import contextmanager
from typing import Optional

from pcg import PcgEngine


engine = PcgEngine()
alpha = string.ascii_letters
alpha_numeric = string.ascii_letters + string.digits


@contextmanager
def ctx_open(path: str, flags: int, mode: int = None):
    if mode is None:
        fd = os.open(path, flags)
    else:
        fd = os.open(path, flags, mode)
    try:
        yield fd
    finally:
        os.close(fd)


def random_id(length: int = 16):
    result = engine.choice(alpha)
    for _ in range(length - 1):
        result += engine.choice(alpha_numeric)
    return result
