# Development

Thanks for contributing! We want to ensure that `urql` evolves and fulfills
its idea of extensibility and flexibility by seeing continuous improvements
and enhancements, no matter how small or big they might be.

If you're about to add a new exchange, please consider publishing it as
a separate package.

## How to contribute?

We follow fairly standard but lenient rules around pull requests and issues.
Please pick a title that describes your change briefly, optionally in the imperative
mood if possible.

If you have an idea for a feature or want to fix a bug, consider opening an issue
first. We're also happy to discuss and help you open a PR and get your changes
in!

## How do I set up the project?

Luckily it's not hard to get started. You can install dependencies using yarn.
Please don't use `npm` to respect the lockfile.

```sh
yarn
```

There are multiple commands you can run in the root folder to test your changes:

```sh
# TypeScript checks:
yarn run check

# Linting (prettier & eslint):
yarn run lint

# Jest Tests (for all packages):
yarn run test

# Builds (for all packages):
yarn run build
```

You can find the main packages in `packages/*` and the addon exchanges in `exchanges/*`.
Each package also has its own scripts that are common and shared between all packages.

```sh
# Jest Tests for the current package:
yarn run test

# Builds for the current package:
yarn run build

# TypeScript checks for the current package:
yarn run check
```

While you can run `build` globally in the interest of time it's advisable to only run it
on the packages you're working on. Note that TypeScript checks don't require any packages
to be built.

## How do I test my changes?

It's always good practice to run the tests when making changes. If you're unsure which packages
may be affected by your new tests or changes you may run `yarn test --watch` in the root of
the repository.

If your editor is not set up with type checks you may also want to run `yarn run check` on your
changes.

Additionally you can head to any example in the `examples/` folder
and run them. There you'll also need to run `yarn` to install their
dependencies. All examples are started using `yarn start`.

## How do I lint my code?

We ensure consistency in `urql`'s codebase using `eslint` and `prettier`.
They are run on a `precommit` hook, so if something's off they'll try
to automatically fix up your code, or display an error.

If you have them set up in your editor, even better!

## How do I document a change for the changelog?

This project uses [changesets](https://github.com/atlassian/changesets). This means that for
every PR there must be documentation for what has been changed and which package is affected.

You can document a change by running `yarn changeset`, which will ask you which packages
have changed and whether the change is major/minor/patch. It will then ask you to write
a change entry as markdown.

This will eventually end up in the package's `CHANGELOG.md` file when we do a release.

[Read more about adding a `changeset` here.](https://github.com/atlassian/changesets/blob/master/docs/adding-a-changeset.md#i-am-in-a-multi-package-repository-a-mono-repo)

## How do I upgrade all dependencies?

It may be a good idea to keep all dependencies on the `urql` repository up-to-date every now and
then. Typically we do this by running `yarn upgrade-interactive --latest` and checking one-by-one
which dependencies will need to be bumped. In case of any security issues it may make sense to
just run `yarn upgrade [package]`.

Afterwards `yarn` may accidentally introduce duplicate packages due to some transitive dependencies
having been upgraded separately. This can be fixed by running:

```sh
npx yarn-deduplicate yarn.lock
yarn
```

## How do I add a new package?

When adding a new package, start by copying a `package.json` file from another project.
You may want to alter the following fields first:

- `name`
- `version` (either start at `0.1.0` or `1.0.0`)
- `description`
- `repository.directory`
- `keywords`

Make sure to also alter the `devDependencies`, `peerDependencies`, and `dependencies` to match
the new package's needs.

**The `main` and `module` fields follow a convention:**
All output bundles will always be output in the `./dist` folder by `rollup`, which is set up in
the `build` script. Their filenames are a "kebab case" (dash-cased) version of the `name` field with
an appropriate extension (`.esm.js` for `module` and `.cjs.js` for `main`).

If your entrypoint won't be at `src/index.ts` you may alter it. But the `types` field has to match
the same file relative to the `dist/types` folder, where `rollup` will output the TypeScript
declaration files. When setting up your package make sure to create a `src/index.ts` file (or a file
at what you've set `source` to)

The `scripts.prepare` task is set up to check your new `package.json` file for correctness. So in
case you get anything wrong, you'll get a short error when running `yarn` after setting your new
project up. Just in case! 😄

Lastly, your new package will need to be added to the `tsconfig.json` in the root of the repository.
Add a new entry to `compilerOptions.paths` where the key is the `name` you've used in your
`package.json` and the value is an array with a single entry, the path to your package + `src/`.

Afterwards you can check whether everything is working correctly by running:

```sh
yarn
yarn run check
```

## How do I release new versions of our packages?

The process of releasing versions is automated using `changeset`. This moves a lot of
the work of writing CHANGELOG entries away from our release process and to our PR
review process. During the release the created `changeset` entries are automatically
applied and our `CHANGELOG`s are updated.

First check what changes you're about to release with `yarn changeset status`.

Then the process is similar to using `yarn version` and `yarn publish`:

```sh
# This will automatically bump versions as necessary and update CHANGELOG files:
yarn changeset version
# Please check all versions and CHANGELOGs manually.
# Then publish all new packages / versions:
yarn changeset publish
```
