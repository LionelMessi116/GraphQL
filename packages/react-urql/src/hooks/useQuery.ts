import { DocumentNode } from 'graphql';
import { useCallback, useMemo } from 'react';
import { pipe, concat, fromValue, switchMap, map, scan } from 'wonka';

import {
  TypedDocumentNode,
  CombinedError,
  OperationContext,
  RequestPolicy,
  Operation,
} from '@urql/core';

import { useClient } from '../context';
import { useSource } from './useSource';
import { useRequest } from './useRequest';
import { initialState } from './constants';

export interface UseQueryArgs<Variables = object, Data = any> {
  query: string | DocumentNode | TypedDocumentNode<Data, Variables>;
  variables?: Variables;
  requestPolicy?: RequestPolicy;
  pollInterval?: number;
  context?: Partial<OperationContext>;
  pause?: boolean;
}

export interface UseQueryState<Data = any, Variables = object> {
  fetching: boolean;
  stale: boolean;
  data?: Data;
  error?: CombinedError;
  extensions?: Record<string, any>;
  operation?: Operation<Data, Variables>;
}

export type UseQueryResponse<Data = any, Variables = object> = [
  UseQueryState<Data, Variables>,
  (opts?: Partial<OperationContext>) => void
];

export function useQuery<Data = any, Variables = object>(
  args: UseQueryArgs<Variables, Data>
): UseQueryResponse<Data, Variables> {
  const client = useClient();

  // This creates a request which will keep a stable reference
  // if request.key doesn't change
  const request = useRequest<Data, Variables>(args.query, args.variables);

  // Create a new query-source from client.executeQuery
  const makeQuery$ = useCallback(
    (opts?: Partial<OperationContext>) => {
      return client.executeQuery<Data, Variables>(request, {
        requestPolicy: args.requestPolicy,
        pollInterval: args.pollInterval,
        ...args.context,
        ...opts,
      });
    },
    [client, request, args.requestPolicy, args.pollInterval, args.context]
  );

  const [state, update] = useSource(
    useMemo(() => (args.pause ? null : makeQuery$()), [args.pause, makeQuery$]),
    useCallback(
      (query$$, prevState: UseQueryState<Data, Variables> | undefined) => {
        return pipe(
          query$$,
          switchMap(query$ => {
            if (!query$) return fromValue({ fetching: false, stale: false });

            return concat([
              // Initially set fetching to true
              fromValue({ fetching: true, stale: false }),
              pipe(
                query$,
                map(({ stale, data, error, extensions, operation }) => ({
                  fetching: false,
                  stale: !!stale,
                  data,
                  error,
                  operation,
                  extensions,
                }))
              ),
              // When the source proactively closes, fetching is set to false
              fromValue({ fetching: false, stale: false }),
            ]);
          }),
          // The individual partial results are merged into each previous result
          scan(
            (result: UseQueryState<Data, Variables>, partial) => ({
              ...result,
              ...partial,
            }),
            prevState || initialState
          )
        );
      },
      []
    )
  );

  // This is the imperative execute function passed to the user
  const executeQuery = useCallback(
    (opts?: Partial<OperationContext>) => update(makeQuery$(opts)),
    [update, makeQuery$]
  );

  return [state, executeQuery];
}
