from pydantic import BaseModel


class ErrorReply(BaseModel):
    description: str


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str


class AuthRequest(BaseModel):
    token: str


class User(BaseModel):
    name: str
    hashed_password: bytes
    is_gm: bool = False
