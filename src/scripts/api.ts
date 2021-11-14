import { setContext } from '@apollo/client/link/context';
import { WebSocketLink } from '@apollo/client/link/ws';
import { getMainDefinition } from '@apollo/client/utilities';
import { gql } from "@apollo/client";
import * as apollo from "@apollo/client";

import { User } from "./models";

let wsUri: string;
if (window.location.protocol === "https:") {
    wsUri = `wss://${window.location.host}/api/graphql`;
}
else {
    wsUri = `ws://${window.location.host}/api/graphql`;
}

const wsLink = new WebSocketLink({
    uri: wsUri,
    options: {
        reconnect: true,
        connectionParams: { "token": localStorage.getItem('token') }
    },
});

const httpLink = apollo.createHttpLink({
    uri: '/api/graphql',
});

const splitLink = apollo.split(
    ({ query }) => {
        const definition = getMainDefinition(query);
        return (
            definition.kind === 'OperationDefinition' &&
            definition.operation === 'subscription'
        );
    },
    wsLink,
    httpLink,
);

const authLink = setContext((_, { headers }) => {
    const token = localStorage.getItem('token');
    return {
        headers: {
            ...headers,
            authorization: token ? `Bearer ${token}` : "",
        }
    }
});


export const client = new apollo.ApolloClient({
    link: authLink.concat(splitLink),
    cache: new apollo.InMemoryCache()
});


export async function currentUser(): Promise<User> {
    const response = await client.query({
        query: gql`
            query CurrentUser {
                user {
                    id
                    name
                    isGm
                }
            }
        `
    });
    return response.data.user;
}
