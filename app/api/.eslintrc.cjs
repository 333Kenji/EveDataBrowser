module.exports = {
  root: false,
  env: { node: true, es2022: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': ['error', { ignoreRestArgs: true }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-misused-promises': 'off'
  },
  overrides: [
    {
      files: ['tests/**/*.ts'],
      env: { node: true, es2022: true, jest: true },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off'
      }
    }
  ]
};