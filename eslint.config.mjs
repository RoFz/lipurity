import userscripts from 'eslint-plugin-userscripts';

export default [
  {
    files: ['lipurity.user.js'],
    plugins: { userscripts },
    rules: {
      ...userscripts.configs.recommended.rules,
      // The release-please version-bump markers wrap the metadata block, so
      // the block cannot be the very first line of the file.
      'userscripts/no-invalid-metadata': ['error', { top: 'optional' }],
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        getComputedStyle: 'readonly',
        MutationObserver: 'readonly',
        setTimeout: 'readonly',
      },
    },
    settings: {
      userscriptVersions: {
        tampermonkey: '*',
        greasemonkey: '*',
        violentmonkey: '*',
      },
    },
  },
];
