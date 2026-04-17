/**
 * Global E2E test teardown.
 * Closes any lingering connections after the test suite completes.
 * Individual tests are responsible for closing their own NestJS app instances.
 */
module.exports = async (): Promise<void> => {
  console.log('[teardown] E2E test suite complete. Cleaning up.');

  // Allow any pending timers / async operations to flush before the process exits.
  await new Promise<void>((resolve) => setTimeout(resolve, 500));
};
