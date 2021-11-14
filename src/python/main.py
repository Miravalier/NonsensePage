import secrets
from typing import Any

from db import db
from db_models import DBUser
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from schemas import schema
from security import check_password
from strawberry.fastapi import GraphQLRouter
from strawberry.fastapi.handlers import GraphQLTransportWSHandler, GraphQLWSHandler
from strawberry.subscriptions.protocols.graphql_transport_ws.types import ConnectionInitMessage
from strawberry.subscriptions.protocols.graphql_ws.types import OperationMessage

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


class AuthGraphQLTransportWSHandler(GraphQLTransportWSHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.connection_init_parameters = None

    async def handle_connection_init(self, message: ConnectionInitMessage) -> None:
        await super().handle_connection_init(message)
        self.connection_init_parameters = message.payload

    async def get_context(self) -> Any:
        context = await super().get_context()
        context["connection_parameters"] = self.connection_init_parameters
        return context


class AuthGraphQLWSHandler(GraphQLWSHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.connection_init_parameters = None

    async def handle_connection_init(self, message: OperationMessage) -> None:
        await super().handle_connection_init(message)
        self.connection_init_parameters = message["payload"]

    async def get_context(self) -> Any:
        context = await super().get_context()
        context["connection_parameters"] = self.connection_init_parameters
        return context


class AuthGraphQLRouter(GraphQLRouter):
    graphql_ws_handler_class = AuthGraphQLWSHandler
    graphql_transport_ws_handler_class = AuthGraphQLTransportWSHandler


graphql_app = AuthGraphQLRouter(schema)
app.include_router(graphql_app, prefix="/api/graphql")
