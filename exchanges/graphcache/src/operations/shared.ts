import { FieldNode, InlineFragmentNode, FragmentDefinitionNode } from 'graphql';
import {
  isInlineFragment,
  getTypeCondition,
  getSelectionSet,
  getName,
  SelectionSet,
  isFieldNode,
} from '../ast';
import { warn, pushDebugNode, popDebugNode } from '../helpers/help';

import { hasField } from '../store/data';
import { Store, keyOfField } from '../store';

import { Fragments, Variables, DataField, NullArray, Data } from '../types';

import { getFieldArguments, shouldInclude, isInterfaceOfType } from '../ast';

export interface Context {
  store: Store;
  variables: Variables;
  fragments: Fragments;
  parentTypeName: string;
  parentKey: string;
  parentFieldKey: string;
  fieldName: string;
  partial: boolean;
  optimistic: boolean;
}

export const makeContext = (
  store: Store,
  variables: Variables,
  fragments: Fragments,
  typename: string,
  entityKey: string,
  optimistic?: boolean
): Context => ({
  store,
  variables,
  fragments,
  parentTypeName: typename,
  parentKey: entityKey,
  parentFieldKey: '',
  fieldName: '',
  partial: false,
  optimistic: !!optimistic,
});

export const updateContext = (
  ctx: Context,
  typename: string,
  entityKey: string,
  fieldKey: string,
  fieldName: string
) => {
  ctx.parentTypeName = typename;
  ctx.parentKey = entityKey;
  ctx.parentFieldKey = fieldKey;
  ctx.fieldName = fieldName;
};

const isFragmentHeuristicallyMatching = (
  node: InlineFragmentNode | FragmentDefinitionNode,
  typename: void | string,
  entityKey: string,
  vars: Variables
) => {
  if (!typename) return false;
  const typeCondition = getTypeCondition(node);
  if (typename === typeCondition) return true;

  warn(
    'Heuristic Fragment Matching: A fragment is trying to match against the `' +
      typename +
      '` type, ' +
      'but the type condition is `' +
      typeCondition +
      '`. Since GraphQL allows for interfaces `' +
      typeCondition +
      '` may be an' +
      'interface.\nA schema needs to be defined for this match to be deterministic, ' +
      'otherwise the fragment will be matched heuristically!',
    16
  );

  return !getSelectionSet(node).some(node => {
    if (!isFieldNode(node)) return false;
    const fieldKey = keyOfField(getName(node), getFieldArguments(node, vars));
    return !hasField(entityKey, fieldKey);
  });
};

export class SelectionIterator {
  typename: void | string;
  entityKey: string;
  indexStack: number[];
  context: Context;
  selectionStack: SelectionSet[];

  constructor(
    typename: void | string,
    entityKey: string,
    select: SelectionSet,
    ctx: Context
  ) {
    this.typename = typename;
    this.entityKey = entityKey;
    this.context = ctx;
    this.indexStack = [0];
    this.selectionStack = [select];
  }

  next(): void | FieldNode {
    while (this.indexStack.length !== 0) {
      const index = this.indexStack[this.indexStack.length - 1]++;
      const select = this.selectionStack[this.selectionStack.length - 1];
      if (index >= select.length) {
        this.indexStack.pop();
        this.selectionStack.pop();
        if (process.env.NODE_ENV !== 'production') {
          popDebugNode();
        }
        continue;
      } else {
        const node = select[index];
        if (!shouldInclude(node, this.context.variables)) {
          continue;
        } else if (!isFieldNode(node)) {
          // A fragment is either referred to by FragmentSpread or inline
          const fragmentNode = !isInlineFragment(node)
            ? this.context.fragments[getName(node)]
            : node;

          if (fragmentNode !== undefined) {
            if (process.env.NODE_ENV !== 'production') {
              pushDebugNode(this.typename, fragmentNode);
            }

            const isMatching = this.context.store.schema
              ? isInterfaceOfType(
                  this.context.store.schema,
                  getTypeCondition(fragmentNode),
                  this.typename
                )
              : isFragmentHeuristicallyMatching(
                  fragmentNode,
                  this.typename,
                  this.entityKey,
                  this.context.variables
                );

            if (isMatching) {
              this.indexStack.push(0);
              this.selectionStack.push(getSelectionSet(fragmentNode));
            }
          }

          continue;
        } else if (getName(node) === '__typename') {
          continue;
        } else {
          return node;
        }
      }
    }

    return undefined;
  }
}

export const ensureData = (x: DataField): Data | NullArray<Data> | null =>
  x === undefined ? null : (x as Data | NullArray<Data>);
