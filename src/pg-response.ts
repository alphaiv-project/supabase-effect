import type {
  PostgrestResponse,
  PostgrestMaybeSingleResponse,
  PostgrestSingleResponse,
} from "@supabase/supabase-js";
import * as Effect from "effect/Effect";
import { PostgrestError } from "./postgrest-error.js";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import {
  decodePure,
  decodePureResult,
  PureSchemaWithEncodedType,
} from "./schema.js";
import { pipe } from "effect";
import * as Array from "effect/Array";
import * as Types from "effect/Types";
import * as Function from "effect/Function";
import { transpose } from "./effect-util.js";

/**
 * Map supabase's response to Effect<Array, PostgrestError>.
 *
 * @example
 * ```ts
 * const res = Effect.promise(() => client.from("some_table").select()).pipe(
 *   PgResponse.flatMapMultiple()
 * )
 * ```
 *
 * @typeParam T - The type of the response data.
 *
 * @since 0.1.0
 */
export function flatMapMultiple(): <T>(
  res: PostgrestResponse<T>
) => Effect.Effect<Array<T>, PostgrestError> {
  return <A>(
    res: PostgrestResponse<A>
  ): Effect.Effect<Array<A>, PostgrestError> =>
    res.error
      ? Effect.fail(new PostgrestError(res.error))
      : Effect.succeed(res.data);
}

/**
 * Map supabase's response to Effect<Array, PostgrestError> with schema transformation.
 *
 * NOTE: this will return failed `Effect` if any item fails to decode, and run effects concurrently.
 *
 * @example
 * ```ts
 * const res = Effect.promise(() => client.from("some_table").select()).pipe(
 *   PgResponse.flatMapMultipleWithSchema(SomeTableSchema)
 * )
 * ```
 *
 * @typeParam A - The type of decoded response data.
 * @typeParam I - The type of raw(undecoded) response data.
 *
 * @see {@link filterMapMultipleWithSchema} - Use this if you want to filter out items that fail to decode.
 *
 * @since 0.1.0
 */
export function flatMapMultipleWithSchema<A, I>(
  s: PureSchemaWithEncodedType<A, I>,
  concurrency?: Types.Concurrency
): (
  res: PostgrestResponse<I>
) => Effect.Effect<Array<A>, PostgrestError | Schema.SchemaError> {
  return (
    res: PostgrestResponse<I>
  ): Effect.Effect<Array<A>, PostgrestError | Schema.SchemaError> =>
    res.error
      ? Effect.fail(new PostgrestError(res.error))
      : Effect.forEach(res.data, decodePure(s), { concurrency });
}

/**
 * Map supabase's response to Effect<Array, PostgrestError> with schema transformation.
 *
 * NOTE: this will filter any item fails to decode.
 *
 * @example
 * ```ts
 * const res = Effect.promise(() => client.from("some_table").select()).pipe(
 *   PgResponse.flatMapMultipleWithSchema(SomeTableSchema)
 * )
 * ```
 *
 * @typeParam A - The type of decoded response data.
 * @typeParam I - The type of raw(undecoded) response data.
 *
 * @see {@link flatMapMultipleWithSchema} - Use this if you want to fail when any item fails to decode.
 *
 * @since 0.1.0
 */
export function filterMapMultipleWithSchema<A, I>(
  s: PureSchemaWithEncodedType<A, I>,
  concurrency?: Types.Concurrency
): (res: PostgrestResponse<I>) => Effect.Effect<Array<A>, PostgrestError> {
  return (res: PostgrestResponse<I>) => {
    if (res.error) {
      return Effect.fail(new PostgrestError(res.error));
    }

    return pipe(
      res.data,
      Effect.forEach((item) => decodePureResult(s)(item), {
        concurrency,
      }),
      Effect.map(Array.filterMap(Function.identity))
    );
  };
}

/**
 * Map supabase's response to Effect of `{ data, count }`, preserving the
 * `count` field returned by Supabase when a `count` option is set on the query.
 *
 * `count` is `null` unless the underlying query was issued with a count option
 * (e.g. `.select("*", { count: "exact" })`).
 *
 * @example
 * ```ts
 * const res = Effect.promise(() =>
 *   client.from("some_table").select("*", { count: "exact" })
 * ).pipe(PgResponse.flatMapMultipleWithCount())
 * ```
 *
 * @typeParam T - The type of the response data.
 *
 * @since 0.4.0
 */
export function flatMapMultipleWithCount(): <T>(
  res: PostgrestResponse<T>
) => Effect.Effect<{ data: Array<T>; count: number | null }, PostgrestError> {
  return <T>(res: PostgrestResponse<T>) =>
    res.error
      ? Effect.fail(new PostgrestError(res.error))
      : Effect.succeed({ data: res.data, count: res.count });
}

/**
 * Map supabase's response to Effect of `{ data, count }` with schema decoding.
 * Fails the `Effect` if any item fails to decode.
 *
 * @typeParam A - The type of decoded response data.
 * @typeParam I - The type of raw(undecoded) response data.
 *
 * @see {@link filterMapMultipleWithCountAndSchema} - Filters out items that fail to decode instead of failing.
 *
 * @since 0.4.0
 */
export function flatMapMultipleWithCountAndSchema<A, I>(
  s: PureSchemaWithEncodedType<A, I>,
  concurrency?: Types.Concurrency
): (
  res: PostgrestResponse<I>
) => Effect.Effect<
  { data: Array<A>; count: number | null },
  PostgrestError | Schema.SchemaError
> {
  return (res: PostgrestResponse<I>) =>
    res.error
      ? Effect.fail(new PostgrestError(res.error))
      : pipe(
          Effect.forEach(res.data, decodePure(s), { concurrency }),
          Effect.map((data) => ({ data, count: res.count }))
        );
}

/**
 * Map supabase's response to Effect of `{ data, count }` with schema decoding,
 * silently filtering out items that fail to decode.
 *
 * @typeParam A - The type of decoded response data.
 * @typeParam I - The type of raw(undecoded) response data.
 *
 * @see {@link flatMapMultipleWithCountAndSchema} - Fails the `Effect` when any item fails to decode.
 *
 * @since 0.4.0
 */
export function filterMapMultipleWithCountAndSchema<A, I>(
  s: PureSchemaWithEncodedType<A, I>,
  concurrency?: Types.Concurrency
): (
  res: PostgrestResponse<I>
) => Effect.Effect<{ data: Array<A>; count: number | null }, PostgrestError> {
  return (res: PostgrestResponse<I>) => {
    if (res.error) {
      return Effect.fail(new PostgrestError(res.error));
    }

    return pipe(
      res.data,
      Effect.forEach((item) => decodePureResult(s)(item), { concurrency }),
      Effect.map(Array.filterMap(Function.identity)),
      Effect.map((data) => ({ data, count: res.count }))
    );
  };
}

/**
 * Map supabase's single response to effect.
 *
 * @example
 * ```ts
 * const res = Effect.promise(() => client.from("some_table").select().eq('id', 'some-id').single()).pipe(
 *   PgResponse.flatMapSingle()
 * )
 * ```
 *
 * @typeParam T - The type of response data.
 *
 * @since 0.1.0
 */
export function flatMapSingle(): <T>(
  res: PostgrestSingleResponse<T>
) => Effect.Effect<T, PostgrestError> {
  return <T>(
    res: PostgrestSingleResponse<T>
  ): Effect.Effect<T, PostgrestError> =>
    res.error
      ? Effect.fail(new PostgrestError(res.error))
      : Effect.succeed(res.data);
}

/**
 * Map supabase's single response to effect with schema transformation.
 *
 * @example
 * ```ts
 * const res = Effect.promise(() => client.from("some_table").select().eq('id', 'some-id').single()).pipe(
 *   PgResponse.flatMapSingleWithSchema(SomeTableSchema)
 * )
 * ```
 *
 * @typeParam A - The type of decoded response data.
 * @typeParam I - The type of raw(undecoded) response data.
 *
 * @since 0.1.0
 */
export function flatMapSingleWithSchema<A, I>(
  s: PureSchemaWithEncodedType<A, I>
): (
  res: PostgrestSingleResponse<I>
) => Effect.Effect<A, PostgrestError | Schema.SchemaError> {
  return (
    res: PostgrestSingleResponse<I>
  ): Effect.Effect<A, PostgrestError | Schema.SchemaError> =>
    res.error
      ? Effect.fail(new PostgrestError(res.error))
      : decodePure(s)(res.data);
}

/**
 * Map supabase's nullable response to Option.Option-based effect.
 *
 * @example
 * ```ts
 * const res = Effect.promise(() => client.from("some_table").select().eq('id', 'some-id').maybeSingle()).pipe(
 *   PgResponse.flatMapNullable()
 * )
 * ```
 *
 * @typeParam T - The type of response data.
 *
 * @since 0.1.0
 */
export function flatMapNullable(): <T>(
  res: PostgrestMaybeSingleResponse<T>
) => Effect.Effect<Option.Option<T>, PostgrestError> {
  return <T>(
    res: PostgrestMaybeSingleResponse<T>
  ): Effect.Effect<Option.Option<T>, PostgrestError> =>
    res.error
      ? Effect.fail(new PostgrestError(res.error))
      : Effect.succeed(Option.fromNullOr(res.data));
}

/**
 * Map supabase's nullable response to Option.Option-based effect with schema transformation.
 *
 * @example
 * ```ts
 * const res = Effect.promise(() => client.from("some_table").select().eq('id', 'some-id').maybeSingle()).pipe(
 *   PgResponse.flatMapNullableWithSchema(SomeTableSchema)
 * )
 * ```
 *
 * @typeParam A - The type of decoded response data.
 * @typeParam I - The type of raw(undecoded) response data.
 *
 * @since 0.1.0
 */
export function flatMapNullableWithSchema<A, I>(
  s: PureSchemaWithEncodedType<A, I>
): (
  res: PostgrestMaybeSingleResponse<I>
) => Effect.Effect<Option.Option<A>, PostgrestError | Schema.SchemaError> {
  return (
    res: PostgrestMaybeSingleResponse<I>
  ): Effect.Effect<Option.Option<A>, PostgrestError | Schema.SchemaError> =>
    res.error
      ? Effect.fail(new PostgrestError(res.error))
      : pipe(res.data, Option.fromNullOr, Option.map(decodePure(s)), transpose);
}
