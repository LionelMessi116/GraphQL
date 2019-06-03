import { DocumentNode } from 'graphql';
import { useContext, useEffect, useRef, useState } from 'react';
import { pipe, toPromise } from 'wonka';
import { Context } from '../context';
import { OperationResult } from '../types';
import { CombinedError, createRequest } from '../utils';

interface UseMutationState<T> {
  fetching: boolean;
  data?: T;
  error?: CombinedError;
}

export type UseMutationResponse<T, V> = [
  UseMutationState<T>,
  (variables?: V) => Promise<OperationResult<T>>
];

export const useMutation = <T = any, V = object>(
  query: DocumentNode | string
): UseMutationResponse<T, V> => {
  const isMounted = useRef(true);
  const client = useContext(Context);
  const [state, setState] = useState<UseMutationState<T>>({
    fetching: false,
    error: undefined,
    data: undefined,
  });

  useEffect(
    () => () => {
      isMounted.current = false;
    },
    []
  );

  const executeMutation = (variables?: V) => {
    setState({ fetching: true, error: undefined, data: undefined });

    const request = createRequest(query, variables as any);

    return pipe(
      client.executeMutation(request),
      toPromise
    ).then(result => {
      const { data, error } = result;

      if (isMounted.current) {
        setState({ fetching: false, data, error });
      }

      return result;
    });
  };

  return [state, executeMutation];
};
