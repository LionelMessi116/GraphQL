import React, { FC } from 'react';
import gql from 'graphql-tag';
import { useSubscription } from 'urql';
import { Error, MessageEntry, Message, MessageResponse } from './components';

export const Messages: FC = () => {
  const handleSubscription = React.useCallback(
    (messages: MessageEntry[] = [], response: MessageResponse) => [
      response.newMessages,
      ...messages,
    ],
    []
  );

  const [res] = useSubscription(
    { query: NewMessageSubQuery },
    handleSubscription
  );

  if (res.error !== undefined) {
    return <Error>{res.error.message}</Error>;
  }

  if (res.data === undefined) {
    return <p>No new messages</p>;
  }

  return (
    <ul>
      {res.data.map(notif => (
        <Message key={notif.id} {...notif} />
      ))}
    </ul>
  );
};

Messages.displayName = 'Messages';

const NewMessageSubQuery = gql`
  subscription messageSub {
    newMessages {
      id
      from
      message
    }
  }
`;
