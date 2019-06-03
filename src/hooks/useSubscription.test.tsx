// Note: Testing for hooks is not yet supported in Enzyme - https://github.com/airbnb/enzyme/issues/2011
jest.mock('../client', () => {
  const d = { data: 1234, error: 5678 };
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { fromArray } = require('wonka');
  const mock = {
    executeSubscription: jest.fn(() => fromArray([d])),
  };

  return {
    createClient: () => mock,
    data: d,
  };
});

import React, { FC } from 'react';
import renderer from 'react-test-renderer';
// @ts-ignore - data is imported from mock only
import { createClient, data } from '../client';
import { useSubscription } from './useSubscription';

// @ts-ignore
const client = createClient() as { executeSubscription: jest.Mock };
const query = 'subscription Example { example }';
let state: any;

const SubscriptionUser: FC<{ q: string }> = ({ q }) => {
  const [s] = useSubscription({ query: q });
  state = s;
  return <p>{s.data}</p>;
};

beforeEach(() => {
  client.executeSubscription.mockClear();
  state = undefined;
});

describe('on initial useEffect', () => {
  it('initialises default state', () => {
    renderer.create(<SubscriptionUser q={query} />);
    expect(state).toMatchSnapshot();
  });

  it('executes subscription', () => {
    renderer.create(<SubscriptionUser q={query} />);
    expect(client.executeSubscription).toBeCalledTimes(1);
  });

  it('passes query to executeSubscription', () => {
    renderer.create(<SubscriptionUser q={query} />);
    expect(client.executeSubscription).toBeCalledWith({
      key: expect.any(Number),
      query: expect.any(Object),
      variables: {},
    });
  });
});

describe('on subscription', () => {
  it('forwards client response', () => {
    const wrapper = renderer.create(<SubscriptionUser q={query} />);
    /**
     * Have to call update (without changes) in order to see the
     * result of the state change.
     */
    wrapper.update(<SubscriptionUser q={query} />);
    expect(state).toEqual({ ...data, fetching: true });
  });
});

describe('on change', () => {
  const qa = 'subscription NewSubA { exampleA }';
  const qb = 'subscription NewSubB { exampleB }';

  it('executes subscription', () => {
    const wrapper = renderer.create(<SubscriptionUser q={query} />);

    /**
     * Have to call update twice for the change to be detected.
     * Only a single change is detected (updating 5 times still only calls
     * execute subscription twice).
     */
    wrapper.update(<SubscriptionUser q={qa} />);
    wrapper.update(<SubscriptionUser q={qa} />);
    wrapper.update(<SubscriptionUser q={qb} />);
    expect(client.executeSubscription).toBeCalledTimes(2);
  });
});
