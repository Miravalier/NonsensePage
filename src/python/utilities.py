import string
from pcg import PcgEngine


engine = PcgEngine()
alpha = string.ascii_letters
alpha_numeric = string.ascii_letters + string.digits


def random_id(length: int = 16):
    result = engine.choice(alpha)
    for _ in range(length - 1):
        result += engine.choice(alpha_numeric)
    return result
