/** Matches the shape every entity parser returns. */
export type EntityResult = {
  kind: string;
  start: number;
  end: number;
  text: string;
  value: unknown;
};
