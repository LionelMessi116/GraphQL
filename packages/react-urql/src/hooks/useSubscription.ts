import { DocumentNode } from 'graphql';
import { pipe, subscribe, onEnd } from 'wonka';
import { useEffect, useState, useCallback, useMemo } from 'react';

import {
  TypedDocumentNode,
  CombinedError,
  OperationContext,
  Operation,
} from '@urql/core';

import { useClient } from '../context';
import { useRequest } from './useRequest';
import { initialState, computeNextState, hasDepsChanged } from './state';

export interface UseSubscriptionArgs<Variables = object, Data = any> {
  query: DocumentNode | TypedDocumentNode<Data, Variables> | string;
  variables?: Variables;
  pause?: boolean;
  context?: Partial<OperationContext>;
}

export type SubscriptionHandler<T, R> = (prev: R | undefined, data: T) => R;

export interface UseSubscriptionState<Data = any, Variables = object> {
  fetching: boolean;
  stale: boolean;
  data?: Data;
  error?: CombinedError;
  extensions?: Record<string, any>;
  operation?: Operation<Data, Variables>;
}

export type UseSubscriptionResponse<Data = any, Variables = object> = [
  UseSubscriptionState<Data, Variables>,
  (opts?: Partial<OperationContext>) => void
];

export function useSubscription<Data = any, Result = Data, Variables = object>(
  args: UseSubscriptionArgs<Variables, Data>,
  handler?: SubscriptionHandler<Data, Result>
): UseSubscriptionResponse<Result, Variables> {
  const client = useClient();
  const request = useRequest<Data, Variables>(args.query, args.variables);

  const source = useMemo(
    () =>
      !args.pause ? client.executeSubscription(request, args.context) : null,
    [client, request, args.pause, args.context]
  );

  const deps = [client, request, args.context, args.pause] as const;

  const [state, setState] = useState(
    () =>
      [source, { ...initialState, fetching: !!source }, handler, deps] as const
  );

  let currentResult = state[1];
  if (
    (source !== state[0] && hasDepsChanged(state[3], deps)) ||
    handler !== state[2]
  ) {
    setState([
      source,
      (currentResult = computeNextState(state[1], { fetching: !!source })),
      handler,
      deps,
    ]);
  }

  useEffect(() => {
    const updateResult = (
      result: Partial<UseSubscriptionState<Data, Variables>>
    ) => {
      setState(state => {
        const nextResult = computeNextState(state[1], result);
        if (state[1] === nextResult) return state;
        if (state[2] && state[1].data !== nextResult.data)
          nextResult.data = state[2](state[1].data, nextResult.data!) as any;
        return [state[0], state[1], nextResult as any, state[3]];
      });
    };

    if (state[0]) {
      return pipe(
        state[0],
        onEnd(() => {
          updateResult({ fetching: false });
        }),
        subscribe(updateResult)
      ).unsubscribe;
    } else {
      updateResult({ fetching: false });
    }
  }, [state[0]]);

  // This is the imperative execute function passed to the user
  const executeSubscription = useCallback(
    (opts?: Partial<OperationContext>) => {
      const source = client.executeSubscription(request, {
        ...args.context,
        ...opts,
      });

      setState(state => [source, state[1], state[2], state[3]]);
    },
    [client, args.context, request]
  );

  return [currentResult, executeSubscription];
}
