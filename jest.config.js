/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: "jsdom",
    roots: ["<rootDir>/AiReplyAssistant"],
    setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
    transform: {
        "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
    },
    collectCoverageFrom: ["AiReplyAssistant/**/*.{ts,tsx}", "!AiReplyAssistant/generated/**", "!AiReplyAssistant/index.ts"],
};
