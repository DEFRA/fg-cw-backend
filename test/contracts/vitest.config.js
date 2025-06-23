export const config = {
  test: {
    testTimeout: 30000,
    environment: "node",
    globals: true,
    setupFiles: ["./test/contracts/setup.js"],
  },
};
