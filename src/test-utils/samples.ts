import {
  ExchangeResult,
  Query,
  Mutation,
  Operation,
  OperationType,
  Subscription,
} from '../types';

const context = {
  fetchOptions: {
    test: 1,
  },
  url: 'http://localhost:3000/graphql',
};

export const queryGql: Query = {
  query: `query getUser($name: String){
    user(name: $name) {
      id
      firstName
      lastName
    }
  }`,
  variables: {
    name: 'Clara',
  },
};

export const mutationGql: Mutation = {
  query: `mutation AddUser($name: String){
    addUser(name: $name) {
      name
    }
  }`,
  variables: {
    name: 'Clara',
  },
};

export const subscriptionGql: Subscription = {
  query: `subscription subscribeToUser($user: String){
    user(user: $user) {
      name
    }
  }
  `,
  variables: {
    user: 'colin',
  },
};

export const queryOperation: Operation = {
  key: '2',
  operationName: OperationType.Query,
  context,
  ...queryGql,
};

export const mutationOperation: Operation = {
  key: JSON.stringify(mutationGql),
  operationName: OperationType.Mutation,
  context,
  ...mutationGql,
};

export const subscriptionOperation: Operation = {
  key: JSON.stringify(subscriptionGql),
  operationName: OperationType.Subscription,
  context,
  ...subscriptionGql,
};

export const queryResponse: ExchangeResult = {
  operation: queryOperation,
  data: {
    user: {
      name: 'Clive',
    },
  },
};

export const mutationResponse: ExchangeResult = {
  operation: mutationOperation,
  data: {},
};

export const subscriptionResponse: ExchangeResult = {
  operation: subscriptionOperation,
  data: {},
};
