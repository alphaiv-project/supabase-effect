import { Data } from "effect";
import { type PostgrestError as SupabasePostgrestError } from "@supabase/supabase-js";
import * as Effect from "effect/Effect";

/**
 * A tagged error class for `@supabase/supabase-js`'s PostgrestError
 */
export class PostgrestError extends Data.TaggedError(
  "effect-supabase/PostgrestError"
)<{
  inner: SupabasePostgrestError;
}> {
  constructor(e: SupabasePostgrestError) {
    super({ inner: e });
  }
}

export namespace PostgrestError {
  /**
   * Type guard for `PostgrestError`.
   */
  export function is(e: unknown): e is PostgrestError {
    return (
      e instanceof Object &&
      e.hasOwnProperty("_tag") &&
      (e as { _tag: string })._tag === "effect-supabase/PostgrestError"
    );
  }

  /**
   * Catches a `PostgrestError` with a given code and effect.
   *
   * Works like `Effect.mapError` but for `PostgrestError`'s built in error code.
   *
   * @example
   * ```ts
   * const result = SomePostgrestEffect.pipe(
   *   PostgrestError.mapCode("PGRST116", () => new Error("Not found"))
   * )
   * ```
   *
   * @see {@link PostgrestError.catchCode} - when you want to treat an errornic situation as a successful one.
   * @since 0.1.0
   * @todo implement type-safe postgres error code
   */
  export function mapCode<E>(
    code: string,
    f: (spe: SupabasePostgrestError) => E
  ) {
    return <A1, E1, R>(
      self: Effect.Effect<A1, E1 | PostgrestError, R>
    ): Effect.Effect<A1, E | E1 | PostgrestError, R> =>
      Effect.catchIf(
        self,
        (e): e is PostgrestError => is(e) && e.inner.code === code,
        (e) => Effect.fail(f(e.inner))
      );
  }

  /**
   * Catches a `PostgrestError` with a given code and effect.
   *
   * Works like `Effect.catchTag` but for `PostgrestError`'s built in error code.
   *
   * @example
   * ```ts
   * const result = SomePostgrestEffect.pipe(
   *   PostgrestError.catchCode("PGRST116", () => Effect.fail(new Error("Not found")))
   * )
   * ```
   *
   * @see {@link PostgrestError.mapCode} - when you want to map the error only to error cases.
   * @since 0.1.0
   * @todo implement type-safe postgres error code
   */
  export function catchCode<A, E, R>(
    code: string,
    f: (spe: SupabasePostgrestError) => Effect.Effect<A, E, R>
  ) {
    return <A1, E1, R1>(
      self: Effect.Effect<A1, E1 | PostgrestError, R | R1>
    ): Effect.Effect<A | A1, E | E1 | PostgrestError, R | R1> =>
      Effect.catchIf(
        self,
        (e): e is PostgrestError => is(e) && e.inner.code === code,
        (e) => f(e.inner)
      );
  }
}
