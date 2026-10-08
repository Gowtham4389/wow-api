/**
 * Starts the Express API and the Vite dev server together, without pulling in
 * an extra process-runner dependency. Ctrl+C stops both.
 */
import { spawn } from 'node:child_process';
import process from 'node:process';

const targets = [
  { name: 'server', color: '\u001b[36m', args: ['run', 'dev', '--workspace', 'server'] },
  { name: 'client', color: '\u001b[35m', args: ['run', 'dev', '--workspace', 'client'] },
];

const RESET = '\u001b[0m';
const children = [];
let shuttingDown = false;

function prefixLines(target, chunk) {
  const text = chunk.toString();
  return text
    .split('\n')
    .filter((line, i, arr) => line.length > 0 || i < arr.length - 1)
    .map((line) => `${target.color}[${target.name}]${RESET} ${line}`)
    .join('\n');
}

for (const target of targets) {
  const child = spawn('npm', target.args, {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: process.env,
  });
  child.stdout.on('data', (c) => console.log(prefixLines(target, c)));
  child.stderr.on('data', (c) => console.error(prefixLines(target, c)));
  child.on('exit', (code) => {
    if (!shuttingDown) {
      console.log(`${target.color}[${target.name}]${RESET} exited with code ${code}`);
      shutdown(code ?? 0);
    }
  });
  children.push(child);
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 200);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
