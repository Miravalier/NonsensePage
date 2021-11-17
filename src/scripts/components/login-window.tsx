import * as React from "react";
import { client } from "../api";
import { gql } from "@apollo/client";

interface LoginProps { }

interface LoginState {
    username: string;
    password: string;
}

export class LoginWindow extends React.Component<LoginProps, LoginState> {
    constructor(props: LoginProps) {
        super(props);
        this.state = {
            username: "",
            password: "",
        };
    }

    async login() {
        if (!this.state.username) {
            window.notifications.warning("The username can't be blank");
            return;
        }
        if (!this.state.password) {
            window.notifications.warning("The password can't be blank");
            return;
        }
        try {
            const response = await client.mutate({
                mutation: gql`
                    mutation Login($username: String!, $password: String!) {
                        login(username: $username, password: $password)
                    }
                `,
                variables: {
                    username: this.state.username,
                    password: this.state.password,
                }
            });
            window.localStorage.setItem('token', response.data.login);
            console.log("Login success!");
            window.location.replace("/");
        }
        catch (e) {
            window.notifications.error("Incorrect username or password");
        }
    }

    onChange(ev: React.ChangeEvent<HTMLInputElement>) {
        const update = {};
        const element = $(ev.target);
        update[element.data("key")] = ev.target.value;
        this.setState(update);
    }

    input(key: string, type?: string) {
        if (!type) {
            type = "text";
        }
        return <input type={type} value={this.state[key]}
            data-key={key} onChange={ev => this.onChange(ev)} />
    }

    render() {
        return (
            <div id="login">
                <h1>Canonhead</h1>
                <img className="logo" src="scroll.png"></img>
                <div className="field">
                    <span className="label">Username</span>
                    {this.input("username")}
                </div>
                <div className="field">
                    <span className="label">Password</span>
                    {this.input("password", "password")}
                </div>
                <div className="button" onClick={() => this.login()}>
                    <i className="fas fa-sign-in"></i>
                    <span>Login</span>
                </div>
            </div>
        );
    }
}
