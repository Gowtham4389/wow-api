import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/**
 * Load `server/.env` into process.env without adding a dependency.
 * `process.loadEnvFile` exists on Node 20.12+/21.7+; on older runtimes the
 * server still works, it just relies on variables already in the environment.
 * Must be imported before anything that reads config.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../.env');

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(envPath);
  } catch (error) {
    // No .env file is the normal case in production, where real environment
    // variables are provided by the platform.
    if (error?.code !== 'ENOENT') {
      console.warn(`[api-inspector] could not read ${envPath}: ${error.message}`);
    }
  }
}
