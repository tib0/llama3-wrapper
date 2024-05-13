module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    'node_modules/node-llama-cpp/.+\\.(j|t)(s|sx)?$': 'ts-jest',
  },
  transformIgnorePatterns: ['node_modules/(?!node-llama-cpp/.*)'],
};
