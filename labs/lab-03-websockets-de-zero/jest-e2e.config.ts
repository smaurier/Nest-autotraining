import type { Config } from "jest";

const config: Config = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testMatch: ["<rootDir>/test/*.e2e-spec.ts"],
  transform: { "^.+\.(t|j)s$": "ts-jest" },
  testEnvironment: "node",
  // de vrais sockets réseau laissent des handles ouverts que Jest met du temps à détecter
  // (voire jamais) : on force la sortie une fois les assertions terminées.
  forceExit: true,
};
export default config;
