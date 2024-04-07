import hashlib
import secrets
from hmac import compare_digest


def hash_password(password: str) -> bytes:
    iterations = 100000
    salt = secrets.token_bytes(16)
    return (
        iterations.to_bytes(4, "big")
        + salt
        + hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            iterations,
        )
    )


def check_password(password: str, hashed_password: bytes) -> bool:
    iterations = int.from_bytes(hashed_password[:4], "big")
    salt = hashed_password[4:20]
    reference_hash = hashed_password[20:]
    given_hash = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return compare_digest(reference_hash, given_hash)
