/**
 * Type-level test utilities.
 *
 * `expectTypeOf(x).toEqualTypeOf<T>()` from vitest/expect-type cannot handle
 * Effect's branded types (Symbol-keyed `[iterator]`, `[TypeId]`, etc.).
 *
 * Instead, we extract the three generic parameters (Success, Error, Context)
 * and assert on those individually via `toEqualTypeOf`. Plain data types
 * don't carry Effect's branding, so expect-type handles them correctly.
 */
import type * as Effect from "effect/Effect";

/** Extract the Success type `A` from `Effect<A, E, R>`. */
export type EffectSuccess<T> =
  T extends Effect.Effect<infer A, infer _E, infer _R> ? A : never;

/** Extract the Error type `E` from `Effect<A, E, R>`. */
export type EffectError<T> =
  T extends Effect.Effect<infer _A, infer E, infer _R> ? E : never;

/** Extract the Context type `R` from `Effect<A, E, R>`. */
export type EffectContext<T> =
  T extends Effect.Effect<infer _A, infer _E, infer R> ? R : never;
