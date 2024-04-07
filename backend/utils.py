import os
from contextlib import contextmanager
from datetime import datetime


def current_timestamp() -> int:
    return int(datetime.now().timestamp())


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
