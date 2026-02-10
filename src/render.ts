/**
 * Tree-based span rendering engine.
 *
 * Arranges entity spans into a parent-child tree (wider spans nest narrower
 * ones), then renders inside-out so that child entities are processed before
 * their parents.
 *
 * @module
 */

/**
 * An entity together with the rendered text of its children.
 *
 * Passed to the {@link RenderFn} callback so you can decide how to render
 * each entity — including its already-rendered nested children.
 */
export interface RenderEntity<E> {
  /** The matched entity (kind, value, start, end, text). */
  entity: E;
  /** The entity's text span with any nested child entities already rendered. */
  children: string;
}

/**
 * Callback used by `Duckling().render` to replace entity spans.
 *
 * Return a string to replace the span, or `undefined` / the original text
 * to leave it unchanged.
 *
 * @example
 * ```ts
 * // Wrap every entity in an HTML tag
 * const fn = ({ entity, children }) =>
 *   `<mark data-kind="${entity.kind}">${children}</mark>`;
 * ```
 */
export type RenderFn<E> = (ctx: RenderEntity<E>) => string | undefined;

/**
 * An entity together with the rendered segments of its children.
 *
 * Passed to the {@link RenderMapFn} callback. `children` is an array of
 * plain-text strings interleaved with already-mapped child values of type `R`.
 * This is ideal for frameworks like React where you need element arrays, not
 * concatenated strings.
 */
export interface RenderMapEntity<E, R> {
  /** The matched entity (kind, value, start, end, text). */
  entity: E;
  /**
   * The entity's inner content as an array of segments: plain-text strings
   * for unmatched gaps and `R` values for child entities already mapped by
   * your callback.
   */
  children: (string | R)[];
}

/**
 * Callback used by `Duckling().renderMap` to map entity spans to
 * arbitrary values.
 *
 * @example
 * ```tsx
 * // React: wrap entities in <mark> elements
 * const fn = ({ entity, children }) =>
 *   <mark data-kind={entity.kind}>{children}</mark>;
 * ```
 */
export type RenderMapFn<E, R> = (ctx: RenderMapEntity<E, R>) => R;

/** @internal Node in the entity span tree used by `render`. */
export type SpanNode = {
  start: number;
  end: number;
  entity: { kind: string; start: number; end: number; text: string } | null;
  children: SpanNode[];
};

/**
 * Build a tree of non-overlapping entity spans.
 *
 * Wider spans become parents of narrower ones. When two spans overlap but
 * neither contains the other, the one that starts earlier wins and the
 * other is dropped.
 *
 * @internal
 */
export function buildSpanTree(
  entities: { kind: string; start: number; end: number; text: string }[],
  inputLength: number,
): SpanNode {
  const root: SpanNode = {
    start: 0,
    end: inputLength,
    entity: null,
    children: [],
  };

  // Sort: earlier start first, wider spans first on tie
  const sorted = [...entities].sort(
    (a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start),
  );

  const stack: SpanNode[] = [root];

  for (const e of sorted) {
    // Pop finished parents
    while (stack.length > 1 && stack[stack.length - 1].end <= e.start) {
      stack.pop();
    }

    const parent = stack[stack.length - 1];

    // Skip if this entity starts before the parent
    if (e.start < parent.start) continue;

    // Clamp rendering bounds to the parent. The entity data is unchanged —
    // only the tree node position is tightened so text isn't duplicated.
    // Example: quantity "4242." [18,23] inside credit_card [3,22]
    //   → node renders [18,22], callback still sees entity.end === 23.
    const clampedEnd = Math.min(e.end, parent.end);
    if (clampedEnd <= e.start) continue;

    const node: SpanNode = {
      start: e.start,
      end: clampedEnd,
      entity: e,
      children: [],
    };
    parent.children.push(node);
    stack.push(node);
  }

  return root;
}

/**
 * Recursively render a span tree node into a single string.
 *
 * Walks children first (inside-out), passing each entity node through `fn`.
 * @internal
 */
export function renderNode(
  node: SpanNode,
  input: string,
  // deno-lint-ignore no-explicit-any
  fn: (ctx: { entity: any; children: string }) => string | undefined,
): string {
  // Build the inner text by interleaving raw text gaps with rendered children
  let result = "";
  let cursor = node.start;

  for (const child of node.children) {
    // Raw text before this child
    if (child.start > cursor) {
      result += input.slice(cursor, child.start);
    }
    result += renderNode(child, input, fn);
    cursor = child.end;
  }

  // Trailing raw text
  if (cursor < node.end) {
    result += input.slice(cursor, node.end);
  }

  // If this is an entity node, pass to the render function
  if (node.entity) {
    const replacement = fn({ entity: node.entity, children: result });
    return replacement !== undefined ? replacement : result;
  }

  return result;
}

/**
 * Recursively render a span tree node into an array of segments.
 *
 * Like {@link renderNode} but returns `(string | R)[]` instead of a single
 * concatenated string — ideal for React/JSX element arrays.
 * @internal
 */
export function renderMapNode<R>(
  node: SpanNode,
  input: string,
  // deno-lint-ignore no-explicit-any
  fn: (ctx: { entity: any; children: (string | R)[] }) => R,
): (string | R)[] {
  const segments: (string | R)[] = [];
  let cursor = node.start;

  for (const child of node.children) {
    if (child.start > cursor) {
      segments.push(input.slice(cursor, child.start));
    }
    const childSegments = renderMapNode<R>(child, input, fn);
    segments.push(...childSegments);
    cursor = child.end;
  }

  if (cursor < node.end) {
    segments.push(input.slice(cursor, node.end));
  }

  if (node.entity) {
    return [fn({ entity: node.entity, children: segments })];
  }

  return segments;
}
