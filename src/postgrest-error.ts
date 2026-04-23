import { Data } from "effect";
import { type PostgrestError as SupabasePostgrestError } from "@supabase/supabase-js";
import * as Effect from "effect/Effect";

/**
 * A tagged error class for `@supabase/supabase-js`'s PostgrestError
 */
export class PostgrestError extends Data.TaggedError(
  "supabase-effect/PostgrestError"
)<{
  inner: SupabasePostgrestError;
}> {
  constructor(e: SupabasePostgrestError) {
    super({ inner: e });
  }
}

export namespace PostgrestError {
  // ---------------------------------------------------------------------------
  // Error code type
  // ---------------------------------------------------------------------------

  /**
   * PostgREST error codes.
   *
   * These are the `PGRST` codes returned by PostgREST in the `code` field of
   * error responses. They are grouped by category:
   *
   * - **Group 0 — Connection**: `PGRST000` – `PGRST003`
   * - **Group 1 — API Request**: `PGRST100` – `PGRST128`
   * - **Group 2 — Schema Cache**: `PGRST200` – `PGRST205`
   * - **Group 3 — JWT**: `PGRST300` – `PGRST303`
   * - **Group X — Internal**: `PGRSTX00`
   *
   * Unknown/custom codes are accepted via the `string & {}` overload of
   * {@link mapCode} / {@link catchCode}, preserving autocomplete for known codes.
   *
   * @see {@link https://postgrest.org/en/stable/references/errors.html | PostgREST Error Reference}
   * @since 0.2.0
   */
  export type ErrorCode =
    // Group 0 — Connection
    | "PGRST000"
    | "PGRST001"
    | "PGRST002"
    | "PGRST003"
    // Group 1 — API Request
    | "PGRST100"
    | "PGRST101"
    | "PGRST102"
    | "PGRST103"
    | "PGRST105"
    | "PGRST106"
    | "PGRST107"
    | "PGRST108"
    | "PGRST111"
    | "PGRST112"
    | "PGRST114"
    | "PGRST115"
    | "PGRST116"
    | "PGRST117"
    | "PGRST118"
    | "PGRST120"
    | "PGRST121"
    | "PGRST122"
    | "PGRST123"
    | "PGRST124"
    | "PGRST125"
    | "PGRST126"
    | "PGRST127"
    | "PGRST128"
    // Group 2 — Schema Cache
    | "PGRST200"
    | "PGRST201"
    | "PGRST202"
    | "PGRST203"
    | "PGRST204"
    | "PGRST205"
    // Group 3 — JWT
    | "PGRST300"
    | "PGRST301"
    | "PGRST302"
    | "PGRST303"
    // Group X — Internal
    | "PGRSTX00";

  /**
   * `PostgrestError` narrowed to a specific inner error code.
   *
   * Distributes over unions so `PostgrestErrorWithCode<"a" | "b">` behaves as a
   * union of tagged variants, letting `Exclude` in {@link catchCode} /
   * {@link mapCode} remove the handled branch. Empty unions collapse to
   * `never`.
   *
   * @since 0.3.1
   */
  export type PostgrestErrorWithCode<EC extends ErrorCode | (string & {})> =
    EC extends unknown ? PostgrestError & { inner: { code: EC } } : never;

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  /**
   * Type guard for `PostgrestError`.
   *
   * @example
   * ```ts
   * if (PostgrestError.is(err)) {
   *   console.log(err.inner.code)
   * }
   * ```
   *
   * @since 0.1.0
   */
  export function is(e: unknown): e is PostgrestError {
    return (
      e instanceof Object &&
      Object.prototype.hasOwnProperty.call(e, "_tag") &&
      (e as { _tag: string })._tag === "supabase-effect/PostgrestError"
    );
  }

  /**
   * Maps a `PostgrestError` with a specific error code to a different error.
   *
   * Works like `Effect.mapError`, but only triggers when the `PostgrestError`'s
   * inner `code` matches the given code. Other errors pass through unchanged.
   *
   * @param code - The PostgREST error code to match (e.g. `"PGRST116"`).
   *   Autocomplete is provided for all known PGRST codes, but any string is accepted
   *   for forward compatibility.
   * @param f - A function that receives the original `SupabasePostgrestError` and
   *   returns the replacement error.
   *
   * @see {@link PostgrestError.catchCode} — when you want to recover with an `Effect` instead.
   *
   * @example
   * Map "not a single object" to a custom error:
   * ```ts
   * const result = somePostgrestEffect.pipe(
   *   PostgrestError.mapCode("PGRST116", (e) => new NotFoundError(e.message)),
   * )
   * ```
   *
   * @example
   * Map a connection error:
   * ```ts
   * const result = somePostgrestEffect.pipe(
   *   PostgrestError.mapCode("PGRST000", () => new DatabaseUnavailableError()),
   * )
   * ```
   *
   * @since 0.1.0
   */
  export function mapCode<E, EC extends ErrorCode>(
    code: EC,
    f: (spe: SupabasePostgrestError & { code: EC }) => E
  ): <A1, E1, R>(
    self: Effect.Effect<A1, E1, R>
  ) => Effect.Effect<A1, E | Exclude<E1, { inner: { code: EC } }>, R>;
  export function mapCode<E, EC extends string & {}>(
    code: EC,
    f: (spe: SupabasePostgrestError) => E
  ): <A1, E1, R>(
    self: Effect.Effect<A1, E1 | PostgrestError, R>
  ) => Effect.Effect<A1, E | E1 | PostgrestError, R>;
  export function mapCode<E, EC extends ErrorCode | (string & {})>(
    code: EC,
    f: (spe: SupabasePostgrestError) => E
  ): <A1, E1, R>(
    self: Effect.Effect<A1, E1 | PostgrestError, R>
  ) => Effect.Effect<A1, E | E1 | PostgrestError, R> {
    return (self) =>
      Effect.catchIf(
        self,
        (e): e is PostgrestError => is(e) && e.inner.code === code,
        (e) => Effect.fail(f(e.inner))
      );
  }

  /**
   * Catches a `PostgrestError` with a specific error code and recovers with an `Effect`.
   *
   * Works like `Effect.catchTag`, but only triggers when the `PostgrestError`'s
   * inner `code` matches the given code. This allows you to turn an error situation
   * into a successful outcome.
   *
   * @param code - The PostgREST error code to match (e.g. `"PGRST116"`).
   *   Autocomplete is provided for all known PGRST codes, but any string is accepted
   *   for forward compatibility.
   * @param f - A function that receives the original `SupabasePostgrestError` and
   *   returns a recovery `Effect`.
   *
   * @see {@link PostgrestError.mapCode} — when you want to map to a different error instead.
   *
   * @example
   * Recover from "not a single object" by returning a default value:
   * ```ts
   * const result = somePostgrestEffect.pipe(
   *   PostgrestError.catchCode("PGRST116", () => Effect.succeed(defaultUser)),
   * )
   * ```
   *
   * @example
   * Recover from "function not found" by falling back to a different query:
   * ```ts
   * const result = somePostgrestEffect.pipe(
   *   PostgrestError.catchCode("PGRST202", () => fallbackQuery),
   * )
   * ```
   *
   * @since 0.1.0
   */
  export function catchCode<A, E, R, EC extends ErrorCode>(
    code: EC,
    f: (spe: SupabasePostgrestError & { code: EC }) => Effect.Effect<A, E, R>
  ): <A1, E1, R1>(
    self: Effect.Effect<A1, E1, R | R1>
  ) => Effect.Effect<
    A | A1,
    E | Exclude<E1, { inner: { code: EC } }>,
    R | R1
  >;
  export function catchCode<A, E, R, EC extends string & {}>(
    code: EC,
    f: (spe: SupabasePostgrestError) => Effect.Effect<A, E, R>
  ): <A1, E1, R1>(
    self: Effect.Effect<A1, E1 | PostgrestError, R | R1>
  ) => Effect.Effect<A | A1, E | E1 | PostgrestError, R | R1>;
  export function catchCode<A, E, R, EC extends ErrorCode | (string & {})>(
    code: EC,
    f: (spe: SupabasePostgrestError) => Effect.Effect<A, E, R>
  ): <A1, E1, R1>(
    self: Effect.Effect<A1, E1 | PostgrestError, R | R1>
  ) => Effect.Effect<A | A1, E | E1 | PostgrestError, R | R1> {
    return (self) =>
      Effect.catchIf(
        self,
        (e): e is PostgrestError => is(e) && e.inner.code === code,
        (e) => f(e.inner)
      );
  }
}
