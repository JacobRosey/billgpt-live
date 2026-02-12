import { pdfWorkerPool } from './pdfWorkerPool.js';

export function parsePdfUsingWorker(b64) {
  return pdfWorkerPool.runJob(b64);
}
