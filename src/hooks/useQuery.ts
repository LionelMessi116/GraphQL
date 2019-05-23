import { DocumentNode } from 'graphql';
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { pipe, subscribe } from 'wonka';
import { Context } from '../context';
import { OperationContext, RequestPolicy } from '../types';
import { CombinedError, createRequest, noop } from '../utils';

export interface UseQueryArgs<V> {
  query: string | DocumentNode;
  variables?: V;
  requestPolicy?: RequestPolicy;
  pause?: boolean;
}

export interface UseQueryState<T> {
  fetching: boolean;
  data?: T;
  error?: CombinedError;
}

export type UseQueryResponse<T> = [
  UseQueryState<T>,
  (opts?: Partial<OperationContext>) => void
];

export const useQuery = <T = any, V = object>(
  args: UseQueryArgs<V>
): UseQueryResponse<T> => {
  const unsubscribe = useRef(noop);

  const client = useContext(Context);
  const request = useMemo(
    () => createRequest(args.query, args.variables as any),
    [args.query, args.variables]
  );

  const [state, setState] = useState<UseQueryState<T>>({
    fetching: false,
    error: undefined,
    data: undefined,
  });

  const executeQuery = useCallback(
    (opts?: Partial<OperationContext>) => {
      unsubscribe.current();

      setState(s => ({ ...s, fetching: true }));

      let teardown = noop;

      if (!args.pause) {
        [teardown] = pipe(
          client.executeQuery(request, {
            requestPolicy: args.requestPolicy,
            ...opts,
          }),
          subscribe(({ data, error }) => {
            setState({ fetching: false, data, error });
          })
        );
      } else {
        setState(s => ({ ...s, fetching: false }));
      }

      unsubscribe.current = teardown;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [request.key, client, args.pause, args.requestPolicy]
  );

  useEffect(() => {
    executeQuery();
    return unsubscribe.current;
  }, [executeQuery]);

  return [state, executeQuery];
};
