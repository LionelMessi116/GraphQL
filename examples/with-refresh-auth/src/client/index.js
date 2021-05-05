import {
  createClient,
  dedupExchange,
  fetchExchange,
  cacheExchange,
  gql,
} from 'urql';
import { makeOperation } from '@urql/core';
import { authExchange } from '@urql/exchange-auth';
import {
  getRefreshToken,
  getToken,
  saveAuthData,
  clearStorage,
} from '../auth/Store';

const REFRESH_TOKEN_MUTATION = gql`
  mutation RefreshCredentials($refreshToken: String!) {
    refreshCredentials(refreshToken: $refreshToken) {
      refreshToken
      token
    }
  }
`;

const getAuth = async ({ authState, mutate }) => {
  if (!authState) {
    const token = getToken();
    const refreshToken = getRefreshToken();

    if (token && refreshToken) {
      return { token, refreshToken };
    }

    return null;
  }

  const result = await mutate(REFRESH_TOKEN_MUTATION, {
    refreshToken: authState.refreshToken,
  });

  if (result.data?.refreshCredentials) {
    saveAuthData(result.data.refreshCredentials);

    return result.data.refreshCredentials;
  }

  // This is where auth has gone wrong and we need to clean up and redirect to a login page
  clearStorage();
  window.location.reload();

  return null;
};

const addAuthToOperation = ({ authState, operation }) => {
  if (!authState || !authState.token) {
    return operation;
  }

  const fetchOptions =
    typeof operation.context.fetchOptions === 'function'
      ? operation.context.fetchOptions()
      : operation.context.fetchOptions || {};

  return makeOperation(operation.kind, operation, {
    ...operation.context,
    fetchOptions: {
      ...fetchOptions,
      headers: {
        ...fetchOptions.headers,
        Authorization: `Bearer ${authState.token}`,
      },
    },
  });
};

const didAuthError = ({ error }) => {
  return error.graphQLErrors.some(e => e.extensions?.code === 'UNAUTHORIZED');
};

const willAuthError = ({ operation, authState }) => {
  if (!authState) {
    // Detect our login mutation and let this operation through:
    return (
      operation.kind !== 'mutation' ||
      // Here we find any mutation definition with the "signin" field
      !operation.query.definitions.some(definition => {
        return (
          definition.kind === 'OperationDefinition' &&
          definition.selectionSet.selections.some(node => {
            // The field name is just an example, since register may also be an exception
            return node.kind === 'Field' && node.name.value === 'signin';
          })
        );
      })
    );
  }

  return true;
};

const client = createClient({
  url: 'https://trygql.dev/graphql/web-collections',
  exchanges: [
    dedupExchange,
    cacheExchange,
    authExchange({ getAuth, addAuthToOperation, didAuthError, willAuthError }),
    fetchExchange,
  ],
});

export default client;
