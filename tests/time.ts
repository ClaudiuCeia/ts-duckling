import { setSystemTime } from "bun:test";

export class FakeTime {
  constructor(now: Date | number | string) {
    setSystemTime(typeof now === "string" ? new Date(now) : now);
  }

  restore(): void {
    setSystemTime();
  }
}
