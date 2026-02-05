import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function parsePdfUsingWorker(b64) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      path.join(__dirname, 'pdfWorker.js'),
      { type: 'module' } 
    );

    worker.once('message', (msg) => {
      if (msg.ok) resolve(msg.text);
      else reject(new Error(msg.error));
    });

    worker.once('error', reject);
    worker.once('exit', (code) => {
      if (code !== 0)
        reject(new Error(`Worker exited with code ${code}`));
    });

    worker.postMessage(b64);
  });
}
