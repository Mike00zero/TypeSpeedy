// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // The game loop keeps its state in a mutable ref and re-renders on demand
    // (like a canvas game). Game.tsx opts out of the React Compiler with
    // "use no memo", so these compiler-purity rules don't apply to it.
    files: ['src/game/Game.tsx'],
    rules: {
      'react-hooks/refs': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/immutability': 'off',
    },
  },
]);
