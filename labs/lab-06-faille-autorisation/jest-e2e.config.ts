import type { Config } from "jest";

const config: Config = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testMatch: ["<rootDir>/test/*.e2e-spec.ts"],
  transform: { "^.+\.(t|j)s$": "ts-jest" },
  testEnvironment: "node",
};
export default config;
