import { useRef, useState, useCallback, useLayoutEffect } from 'react';
import { isSSR } from '../utils';

type SetStateAction<S> = S | ((prevState: S) => S);
type SetState<S> = (action: SetStateAction<S>) => void;

/**
 * This is a drop-in replacement for useState, limited to object-based state.
 * During initial mount it will mutably update the state, instead of scheduling
 * a React update using setState
 */
export const useImmediateState = <S extends {}>(init: S): [S, SetState<S>] => {
  const isMounted = useRef(false);
  const initialState = useRef<S>({ ...init });
  const [state, setState] = useState<S>(initialState.current);

  // This wraps setState and updates the state mutably on initial mount
  const updateState: SetState<S> = useCallback(
    (action: SetStateAction<S>): void => {
      if (!isMounted.current) {
        const newValue =
          typeof action === 'function'
            ? (action as (arg: S) => S)(initialState.current)
            : action;
        Object.assign(initialState.current, newValue);
      } else {
        setState(action);
      }
    },
    []
  );

  !isSSR && // eslint-disable-next-line react-hooks/rules-of-hooks
    useLayoutEffect(() => {
      isMounted.current = true;
      return () => {
        isMounted.current = false;
      };
    }, []);

  return [state, updateState];
};
