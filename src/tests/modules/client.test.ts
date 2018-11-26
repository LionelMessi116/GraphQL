import { Client, defaultCache } from '../../lib';
import { ClientEventType } from '../../interfaces/events';

describe('Client', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should throw without options provided', () => {
    expect(() => {
      /* tslint:disable-next-line no-unused-expression */
      new Client();
    }).toThrowError('Please provide configuration object');
  });

  it('should throw without a url provided', () => {
    expect(() => {
      // @ts-ignore
      new Client({}); /* tslint:disable-line no-unused-expression */
    }).toThrowError('Please provide a URL for your GraphQL API');
  });

  it('should return a client instance', () => {
    const client = new Client({
      url: 'test',
    });
    expect(client.url).toMatch('test');
  });

  it('should apply transformExchange to the exchange', () => {
    const client = new Client({
      transformExchange: x => {
        (x as any).test = true;
        return x;
      },
      url: 'test',
    });

    expect((client.exchange as any).test).toBe(true);
  });

  it('should set fetchOptions', () => {
    const client = new Client({
      fetchOptions: {
        test: 5,
      },
      url: 'test',
    });
    expect(client.fetchOptions).toMatchObject({ test: 5 });
  });

  it('should set fetchOptions to an object if not provided', () => {
    const client = new Client({
      url: 'test',
    });
    expect(client.fetchOptions).toMatchObject({});
  });

  it('should set intialCache if provided', () => {
    const client = new Client({
      url: 'test',
      initialCache: {
        test: 5,
      },
    });
    expect(client.store).toMatchObject({ test: 5 });
  });

  it('should set cache if provided', () => {
    const myCache = defaultCache({});

    const client = new Client({
      cache: myCache,
      url: 'test',
    });

    expect(client.cache).toMatchObject(myCache);
  });

  describe('cache', () => {
    it('should provide a valid cache by default', () => {
      const store = { test: 5 };
      const myCache = defaultCache(store);

      const client = new Client({
        cache: myCache,
        url: 'test',
      });

      expect(client.cache.invalidate).toBeTruthy();
      expect(client.cache.invalidateAll).toBeTruthy();
      expect(client.cache.read).toBeTruthy();
      expect(client.cache.update).toBeTruthy();
      expect(client.cache.write).toBeTruthy();
    });
  });

  describe('refreshAllFromCache', () => {
    let client;

    beforeAll(() => {
      client = new Client({
        url: 'test',
      });
    });

    it('should call all registered subscribers with the last argument of true', () => {
      const spy = jest.fn();
      client.subscribe(spy);
      client.refreshAllFromCache();

      const event = { type: ClientEventType.RefreshAll };
      expect(spy).toBeCalledWith(event.type, undefined);
    });
  });

  describe('deleteCacheKeys', () => {
    let client;

    beforeAll(() => {
      client = new Client({
        url: 'test',
      });
    });

    it('should invalidate key on cache and call listeners', done => {
      const cacheSpy = jest.spyOn(client.cache, 'invalidate');
      const listener = jest.fn();
      client.subscribe(listener);
      client.deleteCacheKeys(['test']);

      setTimeout(() => {
        expect(listener).toBeCalledWith(ClientEventType.CacheKeysInvalidated, [
          'test',
        ]);
        expect(cacheSpy).toBeCalledWith('test');
        done();
      });
    });
  });

  describe('updateCacheEntry', () => {
    let client;

    beforeAll(() => {
      client = new Client({
        url: 'test',
      });
    });

    it('should update key on cache and call listeners', done => {
      const cacheSpy = jest.spyOn(client.cache, 'write');
      const listener = jest.fn();
      client.subscribe(listener);
      const val = { test: true };
      client.updateCacheEntry('test', val);

      setTimeout(() => {
        expect(listener).toBeCalledWith(ClientEventType.CacheKeysInvalidated, [
          'test',
        ]);
        expect(cacheSpy).toBeCalledWith('test', val);
        done();
      });
    });
  });

  describe('invalidateQuery', () => {
    let client;

    beforeAll(() => {
      client = new Client({
        url: 'test',
      });
    });

    it('should invalidate key on cache and call listeners', done => {
      const cacheSpy = jest.spyOn(client.cache, 'invalidate');
      const listener = jest.fn();
      client.subscribe(listener);
      client.invalidateQuery({ query: '{ test }', variables: {} });

      setTimeout(() => {
        expect(listener).toBeCalledWith(ClientEventType.CacheKeysInvalidated, [
          expect.any(String),
        ]);
        expect(cacheSpy).toBeCalledWith(expect.any(String));
        done();
      });
    });
  });

  describe('subscribe', () => {
    let client;

    beforeEach(() => {
      client = new Client({
        url: 'test',
      });
    });

    it('should return an unsubscribe callback', () => {
      const callback = () => {};
      const unsubscribe = client.subscribe(callback);
      expect(unsubscribe).not.toBeNull();
    });

    it('should add function arguments to the internal subscriptions object', () => {
      const callback = () => {};
      expect(Object.keys(client.subscriptions).length).toBe(0);
      client.subscribe(callback);
      expect(Object.keys(client.subscriptions).length).toBe(1);
    });
  });

  describe('unsubscribe', () => {
    let client;

    beforeEach(() => {
      client = new Client({
        url: 'test',
      });
    });

    it('should remove from subscriptions by id', () => {
      const callback = () => {};
      const unsubscribe = client.subscribe(callback);
      expect(Object.keys(client.subscriptions).length).toBe(1);
      unsubscribe();
      expect(Object.keys(client.subscriptions).length).toBe(0);
    });
  });

  describe('executeQuery', () => {
    let client;

    it('should return data if there is data', done => {
      client = new Client({
        url: 'http://localhost:3000/graphql',
      });
      (global as any).fetch.mockReturnValue(
        Promise.resolve({
          status: 200,
          json: () => ({ data: [{ id: 5 }] }),
        })
      );

      client
        .executeQuery({
          query: `{
          todos {
            id
            name
          }
        }`,
        })
        .then(result => {
          expect(result.data).toEqual([{ id: 5 }]);
          done();
        });
    });

    it('should include fetchOptions', done => {
      client = new Client({
        url: 'http://localhost:3000/graphql',
        fetchOptions: {
          test: 5,
        },
      });

      (global as any).fetch.mockReturnValue(
        Promise.resolve({
          status: 200,
          json: () => ({ data: [{ id: 5 }] }),
        })
      );

      client
        .executeQuery({
          query: '{ test }',
        })
        .then(() => {
          expect((global as any).fetch).toHaveBeenCalledWith(
            'http://localhost:3000/graphql',
            {
              body: expect.any(String),
              headers: { 'Content-Type': 'application/json' },
              method: 'POST',
              test: 5,
            }
          );

          done();
        });
    });

    it('should include functional fetchOptions', done => {
      client = new Client({
        fetchOptions: () => ({ test: 5 }),
        url: 'http://localhost:3000/graphql',
      });

      (global as any).fetch.mockReturnValue(
        Promise.resolve({
          json: () => ({ data: [{ id: 5 }] }),
          status: 200,
        })
      );

      client.executeQuery({ query: '{ test }' }).then(() => {
        expect((global as any).fetch).toHaveBeenCalledWith(
          'http://localhost:3000/graphql',
          {
            body: expect.any(String),
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
            test: 5,
          }
        );

        done();
      });
    });

    it('should return "No Data" if data is not present', done => {
      client = new Client({
        url: 'http://localhost:3000/graphql',
      });

      (global as any).fetch.mockReturnValue(
        Promise.resolve({
          status: 200,
          json: () => ({ test: 5 }),
        })
      );

      client
        .executeQuery({
          query: `{
          todos {
            id
            name
          }
        }`,
        })
        .catch(e => {
          expect(e.message).toBe('no data or error');
          done();
        });
    });

    it('should return an error if fetch throws', done => {
      client = new Client({
        url: 'http://localhost:3000/graphql',
      });

      (global as any).fetch.mockReturnValue(
        Promise.reject(new Error('Nooooo'))
      );

      client
        .executeQuery({
          query: `{
          todos {
            id
            name
          }
        }`,
        })
        .catch(e => {
          expect(e.networkError).toMatchObject(new Error('Nooooo'));
          done();
        });
    });
  });

  describe('executeMutation', () => {
    let client;
    it('should return specified data if present', done => {
      client = new Client({
        url: 'http://localhost:3000/graphql',
      });

      (global as any).fetch.mockReturnValue(
        Promise.resolve({
          status: 200,
          json: () => ({ data: { test: 5 } }),
        })
      );

      client
        .executeMutation({
          query: `{
          todos {
            id
            name
          }
        }`,
        })
        .then(data => {
          expect(data).toMatchObject({ test: 5 });
          done();
        });
    });

    it('should return "No Data" if data is not present', done => {
      client = new Client({
        url: 'http://localhost:3000/graphql',
      });

      (global as any).fetch.mockReturnValue(
        Promise.resolve({
          status: 200,
          json: () => ({ test: 5 }),
        })
      );

      client
        .executeMutation({
          query: `{
          todos {
            id
            name
          }
        }`,
        })
        .catch(e => {
          expect(e.message).toBe('no data or error');
          done();
        });
    });

    it('should return an error if fetch throws', done => {
      client = new Client({
        url: 'http://localhost:3000/graphql',
      });

      (global as any).fetch.mockReturnValue(Promise.reject(new Error('Noooo')));

      client
        .executeMutation({
          query: `{
          todos {
            id
            name
          }
        }`,
        })
        .catch(e => {
          expect(e.networkError).toMatchObject(new Error('Noooo'));
          done();
        });
    });

    it('should return an error with attached response if fetch throws an HTTP error', () => {
      client = new Client({
        url: 'http://localhost:3000/graphql',
      });

      (global as any).fetch.mockReturnValue(
        Promise.resolve({
          status: 401,
          statusText: "I'm afraid I can't let you do that, Dave",
        })
      );

      return client
        .executeMutation({
          query: `{
          todos {
            id
            name
          }
        }`,
        })
        .catch(e => {
          expect(e).toHaveProperty('name', 'CombinedError');
          expect(e).toHaveProperty(
            'response.statusText',
            "I'm afraid I can't let you do that, Dave"
          );
          expect(e).toHaveProperty('response.status', 401);
        });
    });
  });
});
