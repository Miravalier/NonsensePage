import * as context from '@apollo/client/link/context';
import * as apollo from "@apollo/client";
import { gql } from "@apollo/client";

import { User } from "./models";


const httpLink = apollo.createHttpLink({
    uri: '/api/graphql',
});

const authLink = context.setContext((_, { headers }) => {
    const token = localStorage.getItem('token');
    return {
        headers: {
            ...headers,
            authorization: token ? `Bearer ${token}` : "",
        }
    }
});


export const client = new apollo.ApolloClient({
    link: authLink.concat(httpLink),
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
