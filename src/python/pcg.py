"""
This PCG random number generator implementation uses Melissa O'Neill's
algorithm described at http://www.pcg-random.org/
"""
from __future__ import annotations

import secrets
from typing import MutableSequence, Sequence, TypeVar

T = TypeVar("T")


class PcgEngine:
    state: int
    inc: int

    def __init__(self, seed: int = None, inc: int = None):
        if seed is None:
            seed = secrets.randbits(64)
        if inc is None:
            inc = secrets.randbits(64)
        self.seed(seed, inc)

    def seed(self, seed: int, inc: int):
        """
        Set the seed and stream for the engine

        Parameters
        ----------
        seed
            uint64 initial state
        inc
            uint63 stream id
        """
        self.state = 0
        self.inc = ((inc << 1) & 0xFFFFFFFFFFFFFFFF) | 1
        self.rand32()
        self.state += seed
        self.rand32()

    def rand32(self) -> int:
        """
        Returns a random uint32
        """
        old_state = self.state
        self.state = (old_state * 6364136223846793005 + self.inc) & 0xFFFFFFFFFFFFFFFF
        xor_shifted = (((old_state >> 18) ^ old_state) >> 27) & 0xFFFFFFFF
        rot = (old_state >> 59) & 0xFFFFFFFF
        return ((xor_shifted >> rot) | (xor_shifted << ((-rot) & 31))) & 0xFFFFFFFF

    def rand64(self) -> int:
        """
        Returns a random uint64
        """
        return self.rand32() | (self.rand32() << 32)

    def rand_below(self, max: int) -> int:
        """
        Returns a random integer between [0, max)
        """
        threshold = 0x100000000 % max
        while (result := self.rand32()) < threshold:
            pass
        return result % max

    def rand_between(self, min: int, max: int) -> int:
        """
        Returns a random integer between [min, max)
        """
        return min + self.rand_below(max - min)

    def rand_float(self) -> float:
        """
        Returns a random float between [0.0, 1.0)
        """
        return self.rand64() / 0x10000000000000000

    def choice(self, sequence: Sequence[T]) -> T:
        """
        Returns a random item out of a sequence
        """
        return sequence[self.rand_below(len(sequence))]

    def shuffle(self, sequence: MutableSequence):
        """
        Shuffles a sequence in-place.
        """
        for i in range(len(sequence) - 1, -1, -1):
            j = self.rand_below(i + 1)
            tmp = sequence[i]
            sequence[i] = sequence[j]
            sequence[j] = tmp

    def child(self) -> PcgEngine:
        """
        Creates a new engine derived from the state of the current one.
        """
        return PcgEngine(self.rand64(), self.rand64())

    def copy(self) -> PcgEngine:
        """
        Creates a new engine with an exact copy of the current engine's state.
        """
        engine = PcgEngine.__new__()
        engine.state = self.state
        engine.inc = self.inc
        return engine
