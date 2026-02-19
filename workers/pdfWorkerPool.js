// pdfWorkerPool.js
import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKER_PATH = path.join(__dirname, 'pdfWorker.js');
const MAX_WORKERS = 3;
const MAX_QUEUE_LENGTH = 15;

class PdfWorkerPool {
    constructor() {
        this.idleWorkers = [];
        this.busyWorkers = new Set();
        this.queue = [];

        // create worker pool
        for (let i = 0; i < MAX_WORKERS; i++) {
            this.idleWorkers.push(this.createWorker());
        }
    }

    createWorker() {
        const worker = new Worker(WORKER_PATH, { type: 'module' });

        worker.on('error', (err) => {
            console.error('Worker error:', err);
            this.busyWorkers.delete(worker);
            this.idleWorkers = this.idleWorkers.filter(w => w !== worker);
            // Replace crashed worker
            this.idleWorkers.push(this.createWorker());
        });

        return worker;
    }

    runJob(data) {
        return new Promise((resolve, reject) => {
            const job = { data, resolve, reject };
            console.log(`Queue Busy: ${this.busyWorkers.size}, Queued: ${this.queue.length}`);
            if (this.queue.length >= MAX_QUEUE_LENGTH) {
                const err = new Error("Too many jobs in queue");
                err.code = "QUEUE_FULL";
                err.status = 503;
                return reject(err);
            }
            if (this.idleWorkers.length > 0) {
                const worker = this.idleWorkers.pop();
                this.execute(worker, job);
            } else {
                this.queue.push(job);
            }
        });
    }

    execute(worker, job) {
        this.busyWorkers.add(worker);

        const handleMessage = (msg) => {
            cleanup();

            if (msg.ok) job.resolve(msg.text);
            else job.reject(new Error(msg.error));

            this.busyWorkers.delete(worker);

            if (this.queue.length > 0) {
                const nextJob = this.queue.shift();
                this.execute(worker, nextJob);
            } else {
                this.idleWorkers.push(worker);
            }
        };

        const handleError = (err) => {
            cleanup();
            job.reject(err);
        };

        const cleanup = () => {
            worker.removeListener('message', handleMessage);
            worker.removeListener('error', handleError);
        };

        worker.once('message', handleMessage);
        worker.once('error', handleError);

        worker.postMessage(job.data);
    }
}

export const pdfWorkerPool = new PdfWorkerPool();
