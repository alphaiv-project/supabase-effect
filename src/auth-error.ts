import * as Data from "effect/Data";
import { AuthError as SupabaseAuthError } from "@supabase/supabase-js";
import * as Effect from "effect/Effect";

export class AuthError extends Data.TaggedError("supabase-effect/AuthError")<{
  inner: SupabaseAuthError;
}> {
  constructor(inner: SupabaseAuthError) {
    super({ inner });
  }
}

export namespace AuthError {
  /**
   * Type guard for `AuthError`.
   */
  export function is(e: unknown): e is AuthError {
    return (
      e instanceof Object &&
      e.hasOwnProperty("_tag") &&
      (e as { _tag: string })._tag === "supabase-effect/AuthError"
    );
  }

  /**
   * Catches a `AuthError` with a given code and effect.
   *
   * Works like `Effect.mapError` but for `AuthError`'s built in error code.
   *
   * @example
   * ```ts
   * const result = SomeAuthEffect.pipe(
   *   AuthError.mapCode("email_exists", () => new Error("duplicate email"))
   * )
   * ```
   *
   * @see {@link AuthError.catchCode} - when you want to treat an errornic situation as a successful one.
   * @since 0.1.0
   * @todo implement type-safe auth error code
   */
  export function mapCode<E>(
    code: string,
    f: (e: AuthError) => E
  ): <A, E1, R>(
    self: Effect.Effect<A, E1 | AuthError, R>
  ) => Effect.Effect<A, E | E1 | AuthError, R> {
    return (self) =>
      Effect.catchIf(
        self,
        (e): e is AuthError => AuthError.is(e) && e.inner.code === code,
        (e) => Effect.fail(f(e))
      );
  }

  /**
   * Catches a `AuthError` with a given code and effect.
   *
   * Works like `Effect.catchTag` but for `AuthError`'s built in error code.
   *
   * @example
   * ```ts
   * const result = SomeAuthEffect.pipe(
   *   AuthError.catchCode("email_exists", () => Effect.fail(new Error("duplicate email")))
   * )
   * ```
   *
   * @see {@link AuthError.mapCode} - when you want to map the error only to error cases.
   * @since 0.1.0
   * @todo implement type-safe auth error code
   */
  export function catchCode<A, E, R>(
    code: string,
    f: (e: AuthError) => Effect.Effect<A, E, R>
  ): <A1, E1, R1>(
    self: Effect.Effect<A1, E1 | AuthError, R | R1>
  ) => Effect.Effect<A | A1, E | E1 | AuthError, R | R1> {
    return (self) =>
      Effect.catchIf(
        self,
        (e): e is AuthError => AuthError.is(e) && e.inner.code === code,
        (e) => f(e)
      );
  }
}
