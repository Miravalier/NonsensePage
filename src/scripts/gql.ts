import { gql } from '@apollo/client';

export const SEND_MESSAGE = gql`
    mutation SendMessage($chatId: String!, $language: String!, $content: String!, $speakerId: String!, $speakerName: String!) {
        sendMessage(chatId: $chatId, language: $language, content: $content, speakerId: $speakerId, speakerName: $speakerName) {
            id
            timestamp
        }
    }
`;

export const GET_MESSAGES = gql`
    query GetMessages($chatId: String!) {
        chat(id: $chatId) {
            id
            messages {
                id
                timestamp
                speakerName
                content
            }
        }
    }
`

export const MESSAGE_SUBSCRIPTION = gql`
    subscription OnMessageUpdate {
        messages {
            chatId
            message {
                id
                timestamp
                speakerName
                content
            }
        }
    }
`;
