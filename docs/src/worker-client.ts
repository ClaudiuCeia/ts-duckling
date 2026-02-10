import type { WorkerRequest, WorkerResponse, EntityResult } from "./types";

type Listener = (resp: WorkerResponse) => void;

let worker: Worker | null = null;
let listener: Listener | null = null;

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./extract.worker.ts", import.meta.url), {
    type: "module",
  });
  worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
    listener?.(ev.data);
  };
  return worker;
}

export function stopWorker() {
  if (!worker) return;
  worker.terminate();
  worker = null;
}

export function extract(
  msg: Omit<WorkerRequest, "type">,
  onResult: Listener,
) {
  listener = onResult;
  ensureWorker().postMessage({ type: "extract", ...msg } satisfies WorkerRequest);
}

export type { EntityResult };
