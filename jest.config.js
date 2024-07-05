require("dotenv").config();
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  // moduleNameMapper: {
  //     '^src/(.*)$': '<rootDir>/src/$1',
  // },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};
