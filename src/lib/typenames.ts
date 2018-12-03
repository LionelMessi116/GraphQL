import {
  DocumentNode,
  FieldNode,
  InlineFragmentNode,
  OperationDefinitionNode,
  SelectionSetNode,
} from 'graphql';

import { parse } from 'graphql/language/parser';
import { print } from 'graphql/language/printer';

const TYPENAME_FIELD: FieldNode = {
  kind: 'Field',
  name: {
    kind: 'Name',
    value: '__typename',
  },
};

function addTypename(selectionSet: SelectionSetNode) {
  if (selectionSet.selections === undefined) {
    return selectionSet;
  }

  const newSet = { ...selectionSet };

  const hasTypeName = selectionSet.selections.some(
    selection =>
      selection.kind === 'Field' &&
      (selection as FieldNode).name.value === '__typename'
  );

  if (!hasTypeName) {
    newSet.selections = [...newSet.selections, TYPENAME_FIELD];
  }

  const nodeRequiresTypename = (node: FieldNode) =>
    node.name.value.lastIndexOf('__', 0) !== 0 && node.selectionSet;

  newSet.selections = newSet.selections.map(selection => {
    const fieldRequiresTypename =
      selection.kind === 'Field' && nodeRequiresTypename(selection);
    const fragmentRequiresTypename =
      selection.kind === 'InlineFragment' &&
      selection.selectionSet !== undefined;

    return fieldRequiresTypename || fragmentRequiresTypename
      ? {
          ...selection,
          selectionSet: addTypename(
            (selection as FieldNode | InlineFragmentNode).selectionSet
          ),
        }
      : selection;
  });

  return newSet;
}

function addTypenameToDocument(doc: DocumentNode) {
  return {
    ...doc,
    definitions: doc.definitions.map((definition: OperationDefinitionNode) => {
      return {
        ...definition,
        selectionSet: addTypename(definition.selectionSet),
      };
    }),
  };
}

// Adds __typename fields to a GraphQL query string
export function formatTypeNames(query: string): string {
  const doc = parse(query);
  return print(addTypenameToDocument(doc));
}

function getTypeNameFromField(obj: object, set: Set<string> = new Set()) {
  let typenames = new Set([...set]);

  for (const prop in obj) {
    if (typeof obj[prop] !== 'object') {
      continue;
    }

    const value = obj[prop];
    typenames =
      value.__typename !== undefined
        ? new Set([...typenames, value.__typename])
        : getTypeNameFromField(value, typenames);
  }

  return typenames;
}

export function gankTypeNamesFromResponse(response: object) {
  const typeNames = getTypeNameFromField(response);
  return [...typeNames].filter((v, i, a) => a.indexOf(v) === i);
}
