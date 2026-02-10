/** Matches the shape every entity parser returns. */
export type EntityResult = {
  kind: string;
  start: number;
  end: number;
  text: string;
  value: unknown;
};

/** Message sent from the main thread to the worker. */
export type WorkerRequest = {
  type: "extract";
  reqId: number;
  text: string;
  ids: string[];
  maxChars: number;
};

/** Message sent from the worker back to the main thread. */
export type WorkerResponse = {
  type: "result";
  reqId: number;
  entities: EntityResult[];
  ms: number;
  truncated: boolean;
  length: number;
};
