import { expect } from "bun:test";

export function assert(value: unknown, message?: string): asserts value {
  expect(value, message).toBeTruthy();
}

export function assertEquals<T>(
  actual: T,
  expected: T,
  message?: string,
): void {
  expect(actual, message).toEqual(expected);
}

export function assertStrictEquals<T>(
  actual: T,
  expected: T,
  message?: string,
): void {
  expect(actual, message).toBe(expected);
}

export function assertObjectMatch<T extends object>(
  actual: T,
  expected: Partial<T>,
  message?: string,
): void {
  expect(actual, message).toMatchObject(expected);
}

export function assertThrows<E extends Error = Error>(
  fn: () => unknown,
  ErrorClass?: new (...args: never[]) => E,
  messageIncludes?: string,
  message?: string,
): E {
  try {
    fn();
  } catch (error) {
    if (ErrorClass && !(error instanceof ErrorClass)) {
      throw new Error(message ?? `Expected ${ErrorClass.name} to be thrown`, {
        cause: error,
      });
    }
    if (!(error instanceof Error)) {
      throw new Error(message ?? "Expected an Error to be thrown", {
        cause: error,
      });
    }
    if (messageIncludes && !error.message.includes(messageIncludes)) {
      throw new Error(
        message ?? `Expected error message to include ${messageIncludes}`,
        { cause: error },
      );
    }
    return error as E;
  }

  throw new Error(message ?? "Expected function to throw");
}
