import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testMatch: ['<rootDir>/test/*.spec.ts'],
  testPathIgnorePatterns: ['\.e2e-spec\.ts$'],
  transform: { '^.+\.(t|j)s$': 'ts-jest' },
  testEnvironment: 'node',
};

export default config;
