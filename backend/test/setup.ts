/**
 * Global E2E test setup.
 * Waits for PostgreSQL and Redis to be reachable before the test suite begins.
 */
import { createConnection } from 'net';

const MAX_RETRIES = 30;
const RETRY_INTERVAL_MS = 1000;

async function waitForPort(
  host: string,
  port: number,
  label: string,
): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await new Promise<void>((resolve, reject) => {
      const socket = createConnection({ host, port }, () => {
        socket.destroy();
        resolve();
      });
      socket.on('error', reject);
      socket.setTimeout(1000, () => {
        socket.destroy();
        reject(new Error('timeout'));
      });
    }).then(
      () => {
        // connection succeeded — break retry loop by throwing a sentinel
        throw new Error('OK');
      },
      () => {
        // connection failed — continue
      },
    ).catch((err: Error) => {
      if (err.message === 'OK') {
        console.log(`[setup] ${label} ready on ${host}:${port}`);
        return;
      }
      throw err;
    });

    if (attempt === MAX_RETRIES) {
      throw new Error(`[setup] Timed out waiting for ${label} on ${host}:${port}`);
    }
    await new Promise((res) => setTimeout(res, RETRY_INTERVAL_MS));
  }
}

module.exports = async (): Promise<void> => {
  const dbHost = process.env['DB_HOST'] ?? 'localhost';
  const dbPort = parseInt(process.env['DB_PORT'] ?? '5432', 10);
  const redisHost = process.env['REDIS_HOST'] ?? 'localhost';
  const redisPort = parseInt(process.env['REDIS_PORT'] ?? '6379', 10);

  await Promise.all([
    waitForPort(dbHost, dbPort, 'PostgreSQL'),
    waitForPort(redisHost, redisPort, 'Redis'),
  ]);

  console.log('[setup] All dependencies ready. Starting E2E tests.');
};
