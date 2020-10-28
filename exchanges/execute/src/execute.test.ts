jest.mock('graphql');

import { fetchExchange } from 'urql';
import { executeExchange } from './execute';
import { execute, print } from 'graphql';
import {
  pipe,
  fromValue,
  toPromise,
  take,
  makeSubject,
  empty,
  Source,
} from 'wonka';
import { mocked } from 'ts-jest/utils';
import { getOperationName } from '@urql/core/utils';
import { queryOperation } from '@urql/core/test-utils';
import { makeErrorResult, makeOperation } from '@urql/core';
import { Client } from '@urql/core/client';
import { OperationResult } from '@urql/core/types';

const schema = 'STUB_SCHEMA' as any;
const exchangeArgs = {
  forward: a => a,
  client: {},
} as any;

const expectedOperationName = getOperationName(queryOperation.query);

const fetchMock = (global as any).fetch as jest.Mock;
afterEach(() => {
  fetchMock.mockClear();
});

const mockHttpResponseData = { key: 'value' };

beforeEach(jest.clearAllMocks);

beforeEach(() => {
  mocked(print).mockImplementation(a => a as any);
  mocked(execute).mockResolvedValue({ data: mockHttpResponseData });
});

describe('on operation', () => {
  it('calls execute with args', async () => {
    const context = 'USER_ID=123';

    await pipe(
      fromValue(queryOperation),
      executeExchange({ schema, context })(exchangeArgs),
      take(1),
      toPromise
    );

    expect(mocked(execute)).toBeCalledTimes(1);
    expect(mocked(execute)).toBeCalledWith(
      schema,
      queryOperation.query,
      undefined,
      context,
      queryOperation.variables,
      expectedOperationName,
      undefined,
      undefined
    );
  });

  it('calls execute after executing context as a function', async () => {
    const context = operation => {
      expect(operation).toBe(queryOperation);
      return 'CALCULATED_USER_ID=' + 8 * 10;
    };

    await pipe(
      fromValue(queryOperation),
      executeExchange({ schema, context })(exchangeArgs),
      take(1),
      toPromise
    );

    expect(mocked(execute)).toBeCalledTimes(1);
    expect(mocked(execute)).toBeCalledWith(
      schema,
      queryOperation.query,
      undefined,
      'CALCULATED_USER_ID=80',
      queryOperation.variables,
      expectedOperationName,
      undefined,
      undefined
    );
  });

  it('should return the same data as the fetch exchange', async () => {
    const context = 'USER_ID=123';

    const responseFromExecuteExchange = await pipe(
      fromValue(queryOperation),
      executeExchange({ schema, context })(exchangeArgs),
      take(1),
      toPromise
    );

    fetchMock.mockResolvedValue({
      status: 200,
      json: jest.fn().mockResolvedValue({ data: mockHttpResponseData }),
    });

    const responseFromFetchExchange = await pipe(
      fromValue(queryOperation),
      fetchExchange({
        dispatchDebug: jest.fn(),
        forward: () => empty as Source<OperationResult>,
        client: {} as Client,
      }),
      toPromise
    );

    expect(responseFromExecuteExchange.data).toEqual(
      responseFromFetchExchange.data
    );
    expect(mocked(execute)).toBeCalledTimes(1);
    expect(fetchMock).toBeCalledTimes(1);
  });
});

describe('on success response', () => {
  it('returns operation result', async () => {
    const response = await pipe(
      fromValue(queryOperation),
      executeExchange({ schema })(exchangeArgs),
      take(1),
      toPromise
    );

    expect(response).toEqual({
      operation: queryOperation,
      data: mockHttpResponseData,
    });
  });
});

describe('on error response', () => {
  const errors = ['error'] as any;

  beforeEach(() => {
    mocked(execute).mockResolvedValue({ errors });
  });

  it('returns operation result', async () => {
    const response = await pipe(
      fromValue(queryOperation),
      executeExchange({ schema })(exchangeArgs),
      take(1),
      toPromise
    );

    expect(response).toHaveProperty('operation', queryOperation);
    expect(response).toHaveProperty('error');
  });
});

describe('on thrown error', () => {
  const errors = ['error'] as any;

  beforeEach(() => {
    mocked(execute).mockRejectedValue({ errors });
  });

  it('returns operation result', async () => {
    const response = await pipe(
      fromValue(queryOperation),
      executeExchange({ schema })(exchangeArgs),
      take(1),
      toPromise
    );

    expect(response).toMatchObject(makeErrorResult(queryOperation, errors));
  });
});

describe('on unsupported operation', () => {
  const operation = makeOperation(
    'teardown',
    queryOperation,
    queryOperation.context
  );

  it('returns operation result', async () => {
    const { source, next } = makeSubject<any>();

    const response = pipe(
      source,
      executeExchange({ schema })(exchangeArgs),
      take(1),
      toPromise
    );

    next(operation);
    expect(await response).toEqual(operation);
  });
});
