import secrets

from db import db
from db_models import DBUser
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from schemas import schema
from security import check_password
from strawberry.fastapi import GraphQLRouter

app = FastAPI()


@app.get("/api/status")
async def index():
    return {"status": "success"}


class LoginRequest(BaseModel):
    username: str
    password: str


@app.post("/api/login")
async def login(request: LoginRequest):
    # Find the requested user by username
    user_entry = db.users.index_get("username", request.username)
    if user_entry is None:
        raise HTTPException(401, "invalid username or password")

    # Convert the db entry to a User model
    user = DBUser.parse_obj(user_entry.data)

    # Check the password
    if not check_password(request.password, user.hashed_password):
        raise HTTPException(401, "invalid username or password")

    # Generate a token and create a session
    token = secrets.token_hex(16)
    db.users.index_set("token", token, user.id)
    return {"status": "success", "token": token}


@app.on_event("shutdown")
async def shutdown():
    print("Saving database ...")
    db.save()


graphql_app = GraphQLRouter(schema)
app.include_router(graphql_app, prefix="/api/graphql")
