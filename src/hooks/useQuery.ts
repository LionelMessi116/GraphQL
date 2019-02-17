import { DocumentNode } from 'graphql';
import { useContext, useEffect, useState } from 'react';
import { pipe, subscribe } from 'wonka';
import { Context } from '../context';
import { OperationContext, RequestPolicy } from '../types';
import { CombinedError, createQuery, noop } from '../utils';

interface UseQueryArgs {
  query: string | DocumentNode;
  variables?: object;
  requestPolicy?: RequestPolicy;
}

interface UseQueryState<T> {
  fetching: boolean;
  data?: T;
  error?: CombinedError;
}

type UseQueryResponse<T> = [
  UseQueryState<T>,
  (opts?: Partial<OperationContext>) => void
];

export const useQuery = <T = any>(args: UseQueryArgs): UseQueryResponse<T> => {
  let unsubscribe = noop;

  const client = useContext(Context);
  const [state, setState] = useState<UseQueryState<T>>({
    fetching: false,
    error: undefined,
    data: undefined,
  });

  const executeQuery = (opts?: Partial<OperationContext>) => {
    unsubscribe();
    setState(s => ({ ...s, fetching: true }));

    const request = createQuery(args.query, args.variables);
    const [teardown] = pipe(
      client.executeQuery(request, {
        requestPolicy: args.requestPolicy,
        ...opts,
      }),
      subscribe(({ data, error }) => setState({ fetching: false, data, error }))
    );

    unsubscribe = teardown;
  };

  useEffect(() => {
    executeQuery();
    return unsubscribe;
  }, [args.query, args.variables]);

  return [state, executeQuery];
};
