import * as InMemoryData from './data';
import { keyOfField } from './keys';

let data: InMemoryData.InMemoryData;

beforeEach(() => {
  data = InMemoryData.make('Query');
  InMemoryData.initDataState(data, null);
});

describe('garbage collection', () => {
  it('erases orphaned entities', () => {
    InMemoryData.writeRecord('Todo:1', '__typename', 'Todo');
    InMemoryData.writeRecord('Todo:1', 'id', '1');
    InMemoryData.writeRecord('Query', '__typename', 'Query');
    InMemoryData.writeLink('Query', 'todo', 'Todo:1');

    InMemoryData.gc(data);

    expect(InMemoryData.readLink('Query', 'todo')).toBe('Todo:1');

    InMemoryData.writeLink('Query', 'todo', undefined);
    InMemoryData.gc(data);

    expect(InMemoryData.readLink('Query', 'todo')).toBe(undefined);
    expect(InMemoryData.readRecord('Todo:1', 'id')).toBe(undefined);

    expect([...InMemoryData.getCurrentDependencies()]).toEqual([
      'Todo:1',
      'Query.todo',
    ]);
  });

  it('keeps readopted entities', () => {
    InMemoryData.writeRecord('Todo:1', '__typename', 'Todo');
    InMemoryData.writeRecord('Todo:1', 'id', '1');
    InMemoryData.writeRecord('Query', '__typename', 'Query');
    InMemoryData.writeLink('Query', 'todo', 'Todo:1');
    InMemoryData.writeLink('Query', 'todo', undefined);
    InMemoryData.writeLink('Query', 'newTodo', 'Todo:1');

    InMemoryData.gc(data);

    expect(InMemoryData.readLink('Query', 'newTodo')).toBe('Todo:1');
    expect(InMemoryData.readLink('Query', 'todo')).toBe(undefined);
    expect(InMemoryData.readRecord('Todo:1', 'id')).toBe('1');

    expect([...InMemoryData.getCurrentDependencies()]).toEqual([
      'Todo:1',
      'Query.todo',
      'Query.newTodo',
    ]);
  });

  it('keeps entities with multiple owners', () => {
    InMemoryData.writeRecord('Todo:1', '__typename', 'Todo');
    InMemoryData.writeRecord('Todo:1', 'id', '1');
    InMemoryData.writeRecord('Query', '__typename', 'Query');
    InMemoryData.writeLink('Query', 'todoA', 'Todo:1');
    InMemoryData.writeLink('Query', 'todoB', 'Todo:1');
    InMemoryData.writeLink('Query', 'todoA', undefined);

    InMemoryData.gc(data);

    expect(InMemoryData.readLink('Query', 'todoA')).toBe(undefined);
    expect(InMemoryData.readLink('Query', 'todoB')).toBe('Todo:1');
    expect(InMemoryData.readRecord('Todo:1', 'id')).toBe('1');

    expect([...InMemoryData.getCurrentDependencies()]).toEqual([
      'Todo:1',
      'Query.todoA',
      'Query.todoB',
    ]);
  });

  it('skips entities with optimistic updates', () => {
    InMemoryData.writeRecord('Todo:1', '__typename', 'Todo');
    InMemoryData.writeRecord('Todo:1', 'id', '1');
    InMemoryData.writeLink('Query', 'todo', 'Todo:1');

    InMemoryData.initDataState(data, 1, true);
    InMemoryData.writeLink('Query', 'temp', 'Todo:1');
    InMemoryData.initDataState(data, 0, true);

    InMemoryData.writeLink('Query', 'todo', undefined);
    InMemoryData.gc(data);

    expect(InMemoryData.readRecord('Todo:1', 'id')).toBe('1');

    InMemoryData.clearLayer(data, 1);
    InMemoryData.gc(data);
    expect(InMemoryData.readRecord('Todo:1', 'id')).toBe(undefined);

    expect([...InMemoryData.getCurrentDependencies()]).toEqual([
      'Query.todo',
      'Todo:1',
    ]);
  });

  it('erases child entities that are orphaned', () => {
    InMemoryData.writeRecord('Author:1', '__typename', 'Author');
    InMemoryData.writeRecord('Author:1', 'id', '1');
    InMemoryData.writeLink('Todo:1', 'author', 'Author:1');
    InMemoryData.writeRecord('Todo:1', '__typename', 'Todo');
    InMemoryData.writeRecord('Todo:1', 'id', '1');
    InMemoryData.writeLink('Query', 'todo', 'Todo:1');

    InMemoryData.writeLink('Query', 'todo', undefined);
    InMemoryData.gc(data);

    expect(InMemoryData.readRecord('Todo:1', 'id')).toBe(undefined);
    expect(InMemoryData.readRecord('Author:1', 'id')).toBe(undefined);

    expect([...InMemoryData.getCurrentDependencies()]).toEqual([
      'Author:1',
      'Todo:1',
      'Query.todo',
    ]);
  });
});

describe('inspectFields', () => {
  it('returns field infos for all links and records', () => {
    InMemoryData.writeRecord('Query', '__typename', 'Query');
    InMemoryData.writeLink('Query', keyOfField('todo', { id: '1' }), 'Todo:1');
    InMemoryData.writeRecord('Query', keyOfField('hasTodo', { id: '1' }), true);

    InMemoryData.writeLink('Query', 'randomTodo', 'Todo:1');

    expect(InMemoryData.inspectFields('Query')).toMatchInlineSnapshot(`
      Array [
        Object {
          "arguments": Object {
            "id": "1",
          },
          "fieldKey": "todo({\\"id\\":\\"1\\"})",
          "fieldName": "todo",
        },
        Object {
          "arguments": null,
          "fieldKey": "randomTodo",
          "fieldName": "randomTodo",
        },
        Object {
          "arguments": null,
          "fieldKey": "__typename",
          "fieldName": "__typename",
        },
        Object {
          "arguments": Object {
            "id": "1",
          },
          "fieldKey": "hasTodo({\\"id\\":\\"1\\"})",
          "fieldName": "hasTodo",
        },
      ]
    `);

    expect([...InMemoryData.getCurrentDependencies()]).toEqual([
      'Query.todo({"id":"1"})',
      'Query.hasTodo({"id":"1"})',
      'Query.randomTodo',
    ]);
  });

  it('returns an empty array when an entity is unknown', () => {
    expect(InMemoryData.inspectFields('Random')).toEqual([]);

    expect([...InMemoryData.getCurrentDependencies()]).toEqual(['Random']);
  });

  it('returns field infos for all optimistic updates', () => {
    InMemoryData.initDataState(data, 1, true);
    InMemoryData.writeLink('Query', 'todo', 'Todo:1');

    expect(InMemoryData.inspectFields('Random')).toMatchInlineSnapshot(
      `Array []`
    );
  });

  it('avoids duplicate field infos', () => {
    InMemoryData.writeLink('Query', 'todo', 'Todo:1');

    InMemoryData.initDataState(data, 1, true);
    InMemoryData.writeLink('Query', 'todo', 'Todo:2');

    expect(InMemoryData.inspectFields('Query')).toMatchInlineSnapshot(`
      Array [
        Object {
          "arguments": null,
          "fieldKey": "todo",
          "fieldName": "todo",
        },
      ]
    `);
  });
});

describe('commutative changes', () => {
  it('always applies out-of-order updates in-order', () => {
    InMemoryData.reserveLayer(data, 1);
    InMemoryData.reserveLayer(data, 2);

    InMemoryData.initDataState(data, 2);
    InMemoryData.writeRecord('Query', 'index', 2);
    InMemoryData.clearDataState();

    InMemoryData.initDataState(data, null);
    expect(InMemoryData.readRecord('Query', 'index')).toBe(2);

    InMemoryData.initDataState(data, 1);
    InMemoryData.writeRecord('Query', 'index', 1);
    InMemoryData.clearDataState();

    InMemoryData.initDataState(data, null);
    expect(InMemoryData.readRecord('Query', 'index')).toBe(2);

    expect(data.optimisticOrder).toEqual([]);
  });

  it('creates optimistic layers that may be removed using clearLayer', () => {
    InMemoryData.reserveLayer(data, 1);
    InMemoryData.reserveLayer(data, 2);

    InMemoryData.initDataState(data, 2);
    InMemoryData.writeRecord('Query', 'index', 2);
    InMemoryData.clearDataState();

    InMemoryData.initDataState(data, null);
    expect(InMemoryData.readRecord('Query', 'index')).toBe(2);

    // Actively clearing out layer 2
    InMemoryData.clearLayer(data, 2);

    InMemoryData.initDataState(data, null);
    expect(InMemoryData.readRecord('Query', 'index')).toBe(undefined);

    InMemoryData.initDataState(data, 1);
    InMemoryData.writeRecord('Query', 'index', 1);
    InMemoryData.clearDataState();

    InMemoryData.initDataState(data, null);
    expect(InMemoryData.readRecord('Query', 'index')).toBe(1);

    expect(data.optimisticOrder).toEqual([]);
  });

  it('overrides data using optimistic layers', () => {
    InMemoryData.reserveLayer(data, 1);
    InMemoryData.reserveLayer(data, 2);
    InMemoryData.reserveLayer(data, 3);

    InMemoryData.initDataState(data, 2);
    InMemoryData.writeRecord('Query', 'index', 2);
    InMemoryData.clearDataState();

    InMemoryData.initDataState(data, 3);
    InMemoryData.writeRecord('Query', 'index', 3);
    InMemoryData.clearDataState();

    // Regular write that isn't optimistic
    InMemoryData.initDataState(data, null);
    InMemoryData.writeRecord('Query', 'index', 1);
    InMemoryData.clearDataState();

    InMemoryData.initDataState(data, null);
    expect(InMemoryData.readRecord('Query', 'index')).toBe(3);

    expect(data.optimisticOrder).toEqual([3, 2, 1]);
  });

  it('avoids optimistic layers when only one layer is pending', () => {
    InMemoryData.reserveLayer(data, 1);

    InMemoryData.initDataState(data, 1);
    InMemoryData.writeRecord('Query', 'index', 2);
    InMemoryData.clearDataState();

    // This will be applied and visible since the above write isn't optimistic
    InMemoryData.initDataState(data, null);
    InMemoryData.writeRecord('Query', 'index', 1);
    InMemoryData.clearDataState();

    InMemoryData.initDataState(data, null);
    expect(InMemoryData.readRecord('Query', 'index')).toBe(1);

    expect(data.optimisticOrder).toEqual([]);
  });

  it('continues applying optimistic layers even if the first one completes', () => {
    InMemoryData.reserveLayer(data, 1);
    InMemoryData.reserveLayer(data, 2);
    InMemoryData.reserveLayer(data, 3);
    InMemoryData.reserveLayer(data, 4);

    InMemoryData.initDataState(data, 1);
    InMemoryData.writeRecord('Query', 'index', 1);
    InMemoryData.clearDataState();

    InMemoryData.initDataState(data, null);
    expect(InMemoryData.readRecord('Query', 'index')).toBe(1);

    InMemoryData.initDataState(data, 3);
    InMemoryData.writeRecord('Query', 'index', 3);
    InMemoryData.clearDataState();

    InMemoryData.initDataState(data, null);
    expect(InMemoryData.readRecord('Query', 'index')).toBe(3);

    InMemoryData.initDataState(data, 4);
    InMemoryData.writeRecord('Query', 'index', 4);
    InMemoryData.clearDataState();

    InMemoryData.initDataState(data, null);
    expect(InMemoryData.readRecord('Query', 'index')).toBe(4);

    InMemoryData.initDataState(data, 2);
    InMemoryData.writeRecord('Query', 'index', 2);
    InMemoryData.clearDataState();

    InMemoryData.initDataState(data, null);
    expect(InMemoryData.readRecord('Query', 'index')).toBe(4);

    expect(data.optimisticOrder).toEqual([]);
  });

  it('allows noopDataState to clear layers only if necessary', () => {
    InMemoryData.reserveLayer(data, 1);
    InMemoryData.reserveLayer(data, 2);

    InMemoryData.noopDataState(data, 2);
    expect(data.optimisticOrder).toEqual([2, 1]);

    InMemoryData.noopDataState(data, 1);
    expect(data.optimisticOrder).toEqual([]);
  });
});
