export default [
  {
    ignores: ['dist/', 'node_modules/', '*.config.*'],
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'off',
    },
  },
];
