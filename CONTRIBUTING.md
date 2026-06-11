# Contributing

By participating in this project, you agree to abide by the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Contribution policy

This repository does not accept external pull requests. Pull request creation
is restricted to collaborators, and the repository is maintained by its owner.
Forks are welcome under the terms of the [MIT license](LICENSE).

What IS welcome, via [issues](https://github.com/RoFz/lipurity/issues):

- **Bug reports**: a filter leaking through, a hidden module reappearing,
  layout breakage after a site update. Use the bug report template and include
  your browser, userscript manager, and UI language.
- **Filter requests**: an injected module type the script does not cover yet.
  Include the exact on-screen header text and, ideally, a screenshot.
- **Label translations**: detection is exact-text and English-only out of the
  box. To add your locale, open an issue with the exact strings your UI
  renders for each filter (character-for-character, including punctuation).
  They will be added to the `LABELS` map.

## Reporting security vulnerabilities

Please **do not** open a public issue for security vulnerabilities.
See [SECURITY.md](SECURITY.md) for the responsible disclosure process.

## Local development (for reference)

The script is a single file, [`lipurity.user.js`](lipurity.user.js), with no
build step. To experiment with a fork:

```sh
git clone https://github.com/<your-fork>/lipurity.git
cd lipurity
npm ci
npx eslint .          # lint, including userscript metadata validation
node --check lipurity.user.js
```

Load the file in your userscript manager's editor to test changes live.

## Commit conventions

Commits follow [Conventional Commits](https://www.conventionalcommits.org/).
Releases are automated with release-please: `feat:` cuts a minor release,
`fix:` a patch. Reserve them for changes to the userscript's behavior.
