import Observable from 'zen-observable-ts';

import {
  ICache,
  IClientOptions,
  IExchange,
  IExchangeResult,
  IQuery,
} from '../interfaces/index';

import { cacheExchange } from './cache-exchange';
import { dedupExchange } from './dedup-exchange';
import { defaultCache } from './default-cache';
import { hashString } from './hash';
import { httpExchange } from './http-exchange';

export default class Client {
  url: string;
  store: object; // Internal store
  subscriptions: object; // Map of subscribed Connect components
  subscriptionSize: number; // Used to generate IDs for subscriptions
  cache: ICache; // Cache object
  exchange: IExchange; // Exchange to communicate with GraphQL APIs
  fetchOptions: RequestInit | (() => RequestInit); // Options for fetch call

  constructor(opts?: IClientOptions) {
    if (!opts) {
      throw new Error('Please provide configuration object');
    } else if (!opts.url) {
      throw new Error('Please provide a URL for your GraphQL API');
    }

    this.url = opts.url;
    this.store = opts.initialCache || {};
    this.subscriptions = {};
    this.subscriptionSize = 0;
    this.cache = opts.cache || defaultCache(this.store);
    this.exchange = cacheExchange(this.cache, dedupExchange(httpExchange()));
    this.fetchOptions = opts.fetchOptions || {};

    // Bind methods
    this.executeQuery = this.executeQuery.bind(this);
    this.executeMutation = this.executeMutation.bind(this);
    this.updateSubscribers = this.updateSubscribers.bind(this);
    this.refreshAllFromCache = this.refreshAllFromCache.bind(this);
  }

  updateSubscribers(typenames, changes) {
    // On mutation, call subscribed callbacks with eligible typenames
    for (const sub in this.subscriptions) {
      if (this.subscriptions.hasOwnProperty(sub)) {
        this.subscriptions[sub](typenames, changes);
      }
    }
  }

  subscribe(
    callback: (changedTypes: string[], response: object) => void
  ): () => void {
    // Create an identifier, add callback to subscriptions
    const id = this.subscriptionSize++;
    this.subscriptions[id] = callback;

    // Return unsubscription function
    return () => {
      delete this.subscriptions[id];
    };
  }

  refreshAllFromCache() {
    // On mutation, call subscribed callbacks with eligible typenames
    return new Promise(resolve => {
      for (const sub in this.subscriptions) {
        if (this.subscriptions.hasOwnProperty(sub)) {
          this.subscriptions[sub](null, null, true);
        }
      }
      resolve();
    });
  }

  makeContext({ skipCache }: { skipCache?: boolean }): Record<string, any> {
    return {
      fetchOptions:
        typeof this.fetchOptions === 'function'
          ? this.fetchOptions()
          : this.fetchOptions,
      skipCache: !!skipCache,
      url: this.url,
    };
  }

  executeQuery$(
    queryObject: IQuery,
    skipCache: boolean
  ): Observable<IExchangeResult> {
    // Create hash key for unique query/variables
    const { query, variables } = queryObject;
    const key = hashString(JSON.stringify({ query, variables }));
    const operation = {
      context: this.makeContext({ skipCache }),
      key,
      operationName: 'query',
      query,
      variables,
    };

    return this.exchange(operation);
  }

  executeQuery(
    queryObject: IQuery,
    skipCache: boolean
  ): Promise<IExchangeResult> {
    return new Promise<IExchangeResult>((resolve, reject) => {
      this.executeQuery$(queryObject, skipCache).subscribe({
        error: reject,
        next: resolve,
      });
    });
  }

  executeMutation$(
    mutationObject: IQuery
  ): Observable<IExchangeResult['data']> {
    // Create hash key for unique query/variables
    const { query, variables } = mutationObject;
    const key = hashString(JSON.stringify({ query, variables }));

    const operation = {
      context: this.makeContext({}),
      key,
      operationName: 'mutation',
      query,
      variables,
    };

    return this.exchange(operation).map((response: IExchangeResult) => {
      // Notify subscribed Connect wrappers
      this.updateSubscribers(response.typeNames, response);
      // Resolve result
      return response.data;
    });
  }

  executeMutation(mutationObject: IQuery): Promise<IExchangeResult['data']> {
    return new Promise<IExchangeResult>((resolve, reject) => {
      this.executeMutation$(mutationObject).subscribe({
        error: reject,
        next: resolve,
      });
    });
  }
}
