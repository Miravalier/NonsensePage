from pydantic import BaseModel


class User(BaseModel):
    name: str
    hashed_password: bytes
    is_gm: bool = False
