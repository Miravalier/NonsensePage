from pydantic import BaseModel


class DBUser(BaseModel):
    id: str
    name: str
    hashed_password: bytes
    is_gm: bool = False
