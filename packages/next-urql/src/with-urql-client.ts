import React, { createElement, useState } from 'react';
import ssrPrepass from 'react-ssr-prepass';

import {
  Provider,
  ssrExchange,
  dedupExchange,
  cacheExchange,
  fetchExchange,
} from 'urql';

import { initUrqlClient, resetClient } from './init-urql-client';

import {
  NextUrqlClientConfig,
  NextUrqlContext,
  WithUrqlProps,
  WithUrqlClientOptions,
  PartialNextContext,
  NextComponentType,
  SSRExchange,
} from './types';

let ssr: SSRExchange;

export function withUrqlClient(
  getClientConfig: NextUrqlClientConfig,
  options?: WithUrqlClientOptions
) {
  if (!options) options = {};

  return <C extends NextComponentType = NextComponentType>(
    AppOrPage: C
  ): NextComponentType => {
    const shouldEnableSuspense = Boolean(
      (AppOrPage.getInitialProps || options!.ssr) && !options!.neverSuspend
    );

    const withUrql = ({ urqlClient, urqlState, ...rest }: WithUrqlProps) => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const forceUpdate = useState(0);

      // eslint-disable-next-line react-hooks/rules-of-hooks
      const client = React.useMemo(() => {
        if (urqlClient) {
          return urqlClient;
        }

        if (!ssr || typeof window === 'undefined')
          ssr = ssrExchange({ initialState: urqlState });

        const clientConfig = getClientConfig(ssr);
        if (!clientConfig.exchanges) {
          // When the user does not provide exchanges we make the default assumption.
          clientConfig.exchanges = [
            dedupExchange,
            cacheExchange,
            ssr,
            fetchExchange,
          ];
        }

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return initUrqlClient(clientConfig, shouldEnableSuspense)!;
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [urqlClient, urqlState, forceUpdate[0]]);

      const resetUrqlClient = () => {
        resetClient();
        ssr = ssrExchange({ initialState: undefined });
        forceUpdate[1](forceUpdate[0] + 1);
      };

      return createElement(
        Provider,
        { value: client },
        createElement(AppOrPage, {
          ...rest,
          urqlClient: client,
          resetUrqlClient,
        })
      );
    };

    // Set the displayName to indicate use of withUrqlClient.
    const displayName = AppOrPage.displayName || AppOrPage.name || 'Component';
    withUrql.displayName = `withUrqlClient(${displayName})`;

    if (AppOrPage.getInitialProps || options!.ssr) {
      withUrql.getInitialProps = async (appOrPageCtx: PartialNextContext) => {
        const AppTree = appOrPageCtx.AppTree!;

        // Determine if we are wrapping an App component or a Page component.
        const isApp = !!appOrPageCtx.Component;
        const ctx = isApp ? appOrPageCtx.ctx! : appOrPageCtx;

        const ssrCache = ssrExchange({ initialState: undefined });
        const clientConfig = getClientConfig(ssrCache, ctx);
        if (!clientConfig.exchanges) {
          // When the user does not provide exchanges we make the default assumption.
          clientConfig.exchanges = [
            dedupExchange,
            cacheExchange,
            ssrCache,
            fetchExchange,
          ];
        }

        const urqlClient = initUrqlClient(clientConfig, !options!.neverSuspend);

        if (urqlClient) {
          (ctx as NextUrqlContext).urqlClient = urqlClient;
        }

        // Run the wrapped component's getInitialProps function.
        let pageProps = {} as any;
        if (AppOrPage.getInitialProps) {
          pageProps = await AppOrPage.getInitialProps(appOrPageCtx as any);
        }

        // Check the window object to determine whether or not we are on the server.
        // getInitialProps runs on the server for initial render, and on the client for navigation.
        // We only want to run the prepass step on the server.
        if (typeof window !== 'undefined') {
          return { ...pageProps, urqlClient };
        }

        const props = { ...pageProps, urqlClient };
        const appTreeProps = isApp ? props : { pageProps: props };

        // Run the prepass step on AppTree. This will run all urql queries on the server.
        if (!options!.neverSuspend) {
          await ssrPrepass(createElement(AppTree, appTreeProps));
        }

        return {
          ...pageProps,
          urqlState: ssrCache ? ssrCache.extractData() : undefined,
          urqlClient,
        };
      };
    }

    return withUrql;
  };
}
