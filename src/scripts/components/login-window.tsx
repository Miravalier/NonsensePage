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
            console.error("The username can't be blank.");
            return;
        }
        if (!this.state.password) {
            console.error("The password can't be blank.");
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
            console.error("Login failed.");
        }
    }

    onChange(ev: React.ChangeEvent<HTMLInputElement>) {
        const update = {};
        const element = $(ev.target);
        update[element.data("key")] = ev.target.value;
        this.setState(update);
    }

    textInput(key: string) {
        return <input type="text" value={this.state[key]}
            data-key={key} onChange={ev => this.onChange(ev)} />
    }

    render() {
        return (
            <div id="login">
                <h1>Canonfire</h1>
                <img className="logo" src="Canonfire.webp"></img>
                <div className="field">
                    <span className="label">Username</span>
                    {this.textInput("username")}
                </div>
                <div className="field">
                    <span className="label">Password</span>
                    {this.textInput("password")}
                </div>
                <div className="button" onClick={() => this.login()}>
                    <i className="fas fa-sign-in"></i>
                    <span>Login</span>
                </div>
            </div>
        );
    }
}
