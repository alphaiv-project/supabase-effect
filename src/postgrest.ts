/* eslint-disable @typescript-eslint/no-explicit-any */

import type {
  PostgrestSingleResponse,
  PostgrestMaybeSingleResponse,
  PostgrestResponse,
} from "@supabase/supabase-js";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Types from "effect/Types";
import { pipe } from "effect";
import { getClient } from "./client";
import { PostgrestError } from "./postgrest-error";
import * as PgResponse from "./pg-response";
import { PureSchemaWithEncodedType } from "./schema";

// Re-export so TypeScript registers `@supabase/postgrest-js` by its portable
// package name when emitting declaration files (prevents TS2742).
export type { PostgrestQueryBuilder } from "@supabase/postgrest-js";

// ---------------------------------------------------------------------------
// Helper types
// ---------------------------------------------------------------------------

/**
 * Extract the row type `T` from a builder whose `PromiseLike` resolves to
 * `PostgrestResponse<T>` (i.e. `PostgrestSingleResponse<T[]>`).
 *
 * This is used by the execute functions to infer the row type from a properly-
 * typed builder produced by {@link from}.
 */
type InferRow<B> =
  B extends PromiseLike<PostgrestResponse<infer T>> ? T : unknown;

// ---------------------------------------------------------------------------
// Builder entry point
// ---------------------------------------------------------------------------

/**
 * Creates a typed PostgREST select query for the given table.
 *
 * This is the **recommended entry point** for read queries. It accesses the
 * {@link Client} service from the Effect context, calls `client.from(tableName).select(columns)`,
 * and returns a typed builder wrapped in an `Effect`.
 *
 * Supabase's type-level query parser computes the exact result type from the
 * column string, preserving full column inference.
 *
 * For mutations (`insert`, `update`, `upsert`, `delete_`), use {@link table} instead.
 *
 * @typeParam DB - The generated Supabase database schema type.
 * @param tableName - The name of the table or view to query.
 * @param columns - A comma-separated string of columns to select. Defaults to `"*"`.
 * @param options - Optional settings for head/count queries.
 *
 * @example
 * ```ts
 * pipe(
 *   Postgrest.from<Database>()("users", "id, name, email"),
 *   Postgrest.eq("active", true),
 *   Postgrest.order("name"),
 *   Postgrest.executeMultiple(),
 * )
 * ```
 *
 * @since 0.3.0
 */
export const from =
  <DB>() =>
  <T extends string, Q extends string = "*">(
    tableName: T,
    columns?: Q,
    options?: { head?: boolean; count?: "exact" | "planned" | "estimated" }
  ) =>
    Effect.map(getClient<DB>(), (client) =>
      client.from(tableName).select(columns, options)
    );

/**
 * Creates a PostgREST query builder for the given table, without applying a select.
 *
 * Use this as the entry point for **mutations** (`insert`, `update`, `upsert`, `delete_`).
 * For read queries, use {@link from} instead which includes column selection and
 * preserves type-level inference.
 *
 * @typeParam DB - The generated Supabase database schema type.
 * @param tableName - The name of the table or view.
 *
 * @example
 * ```ts
 * pipe(
 *   Postgrest.table<Database>()("users"),
 *   Postgrest.insert({ name: "Alice", email: "alice@example.com" }),
 *   Postgrest.execute,
 * )
 * ```
 *
 * @since 0.3.0
 */
export const table =
  <DB>() =>
  <T extends string>(tableName: T) =>
    Effect.map(getClient<DB>(), (client) => client.from(tableName));

// ---------------------------------------------------------------------------
// Query starters
// ---------------------------------------------------------------------------

/**
 * Maps a `PostgrestQueryBuilder` to a select query.
 *
 * The string literal type `Q` is captured at the type level, enabling Supabase's
 * built-in query parser to compute the exact result type from the column string.
 * For example, `select("id, name")` will infer a result type of `{ id: ...; name: ... }`.
 *
 * @param columns - A comma-separated string of columns to select, with support for
 *   embedded resources (e.g. `"id, name, posts(*)"`). Defaults to `"*"`.
 * @param options - Optional settings.
 * @param options.head - When `true`, performs a HEAD request (no response body, count only).
 * @param options.count - Count algorithm to use: `"exact"`, `"planned"`, or `"estimated"`.
 *
 * @example
 * Select specific columns:
 * ```ts
 * pipe(
 *   Postgrest.from<Database>()("users"),
 *   Postgrest.select("id, name"),
 *   Postgrest.executeMultiple(),
 * )
 * ```
 *
 * @since 0.2.0
 */
export const select =
  <Q extends string = "*">(
    columns?: Q,
    options?: { head?: boolean; count?: "exact" | "planned" | "estimated" }
  ) =>
  <QB extends { select: (...args: any[]) => any }, E, R>(
    effect: Effect.Effect<QB, E, R>
  ) =>
    Effect.map(
      effect,
      (qb) => qb.select(columns, options) as ReturnType<QB["select"]>
    );

/**
 * Maps a `PostgrestQueryBuilder` to an insert operation.
 *
 * Combine with {@link select} to return inserted rows, or use {@link execute}
 * to perform the insert without returning data.
 *
 * @param values - The row(s) to insert. Can be a single object or an array of objects.
 * @param options - Optional settings.
 * @param options.count - Count algorithm to use.
 * @param options.defaultToNull - When `true`, missing fields default to `null` instead of the column default.
 *
 * @example
 * Insert a single row:
 * ```ts
 * pipe(
 *   Postgrest.from<Database>()("users"),
 *   Postgrest.insert({ name: "Alice", email: "alice@example.com" }),
 *   Postgrest.execute,
 * )
 * ```
 *
 * @since 0.2.0
 */
export const insert =
  <V>(
    values: V | V[],
    options?: {
      count?: "exact" | "planned" | "estimated";
      defaultToNull?: boolean;
    }
  ) =>
  <
    QB extends {
      insert: (values: NoInfer<V> | NoInfer<V>[], options?: any) => any;
    },
    E,
    R,
  >(
    effect: Effect.Effect<QB, E, R>
  ) =>
    Effect.map(
      effect,
      (qb) => qb.insert(values as any, options) as ReturnType<QB["insert"]>
    );

/**
 * Maps a `PostgrestQueryBuilder` to an update operation.
 *
 * Always chain with a filter (e.g. {@link eq}) to target specific rows.
 *
 * @param values - An object containing the columns to update and their new values.
 * @param options - Optional settings.
 * @param options.count - Count algorithm to use.
 *
 * @example
 * Update a user's name:
 * ```ts
 * pipe(
 *   Postgrest.from<Database>()("users"),
 *   Postgrest.update({ name: "Alice Updated" }),
 *   Postgrest.eq("id", userId),
 *   Postgrest.execute,
 * )
 * ```
 *
 * @since 0.2.0
 */
export const update =
  <V>(values: V, options?: { count?: "exact" | "planned" | "estimated" }) =>
  <QB extends { update: (values: NoInfer<V>, options?: any) => any }, E, R>(
    effect: Effect.Effect<QB, E, R>
  ) =>
    Effect.map(
      effect,
      (qb) => qb.update(values as any, options) as ReturnType<QB["update"]>
    );

/**
 * Maps a `PostgrestQueryBuilder` to an upsert operation.
 *
 * Upsert inserts rows if they don't exist, or updates them if they conflict
 * on the specified constraint.
 *
 * @param values - The row(s) to upsert. Can be a single object or an array of objects.
 * @param options - Optional settings.
 * @param options.onConflict - The column(s) that define the conflict constraint (comma-separated).
 * @param options.ignoreDuplicates - When `true`, skip rows that would cause a conflict instead of updating.
 * @param options.count - Count algorithm to use.
 * @param options.defaultToNull - When `true`, missing fields default to `null` instead of the column default.
 *
 * @example
 * Upsert a row based on email:
 * ```ts
 * pipe(
 *   Postgrest.from<Database>()("users"),
 *   Postgrest.upsert(
 *     { email: "alice@example.com", name: "Alice" },
 *     { onConflict: "email" },
 *   ),
 *   Postgrest.execute,
 * )
 * ```
 *
 * @since 0.2.0
 */
export const upsert =
  <V>(
    values: V | V[],
    options?: {
      onConflict?: string;
      ignoreDuplicates?: boolean;
      count?: "exact" | "planned" | "estimated";
      defaultToNull?: boolean;
    }
  ) =>
  <
    QB extends {
      upsert: (values: NoInfer<V> | NoInfer<V>[], options?: any) => any;
    },
    E,
    R,
  >(
    effect: Effect.Effect<QB, E, R>
  ) =>
    Effect.map(
      effect,
      (qb) => qb.upsert(values as any, options) as ReturnType<QB["upsert"]>
    );

/**
 * Maps a `PostgrestQueryBuilder` to a delete operation.
 *
 * Named `delete_` because `delete` is a JavaScript reserved word.
 * Always chain with a filter (e.g. {@link eq}) to target specific rows.
 *
 * @param options - Optional settings.
 * @param options.count - Count algorithm to use.
 *
 * @example
 * Delete a user by id:
 * ```ts
 * pipe(
 *   Postgrest.from<Database>()("users"),
 *   Postgrest.delete_(),
 *   Postgrest.eq("id", userId),
 *   Postgrest.execute,
 * )
 * ```
 *
 * @since 0.2.0
 */
export const delete_ =
  (options?: { count?: "exact" | "planned" | "estimated" }) =>
  <QB extends { delete: (...args: any[]) => any }, E, R>(
    effect: Effect.Effect<QB, E, R>
  ) =>
    Effect.map(effect, (qb) => qb.delete(options) as ReturnType<QB["delete"]>);

// ---------------------------------------------------------------------------
// Filters (preserves builder type via `as B`)
// ---------------------------------------------------------------------------

/**
 * Filters rows where `column` equals `value`.
 *
 * @param column - The column name to filter on.
 * @param value - The value to compare against.
 *
 * @since 0.2.0
 */
export const eq =
  <CN extends string>(column: CN, value: unknown) =>
  <B extends { eq: (...args: any[]) => any }, E, R>(
    effect: Effect.Effect<B, E, R>
  ): Effect.Effect<B, E, R> =>
    Effect.map(effect, (builder) => builder.eq(column, value) as B);

/**
 * Filters rows where `column` does **not** equal `value`.
 *
 * @param column - The column name to filter on.
 * @param value - The value to exclude.
 *
 * @since 0.2.0
 */
export const neq =
  <CN extends string>(column: CN, value: unknown) =>
  <B extends { neq: (...args: any[]) => any }, E, R>(
    effect: Effect.Effect<B, E, R>
  ): Effect.Effect<B, E, R> =>
    Effect.map(effect, (builder) => builder.neq(column, value) as B);

/**
 * Filters rows where `column` is greater than `value`.
 *
 * @param column - The column name to filter on.
 * @param value - The lower bound (exclusive).
 *
 * @since 0.2.0
 */
export const gt =
  <CN extends string>(column: CN, value: unknown) =>
  <B extends { gt: (...args: any[]) => any }, E, R>(
    effect: Effect.Effect<B, E, R>
  ): Effect.Effect<B, E, R> =>
    Effect.map(effect, (builder) => builder.gt(column, value) as B);

/**
 * Filters rows where `column` is greater than or equal to `value`.
 *
 * @param column - The column name to filter on.
 * @param value - The lower bound (inclusive).
 *
 * @since 0.2.0
 */
export const gte =
  <CN extends string>(column: CN, value: unknown) =>
  <B extends { gte: (...args: any[]) => any }, E, R>(
    effect: Effect.Effect<B, E, R>
  ): Effect.Effect<B, E, R> =>
    Effect.map(effect, (builder) => builder.gte(column, value) as B);

/**
 * Filters rows where `column` is less than `value`.
 *
 * @param column - The column name to filter on.
 * @param value - The upper bound (exclusive).
 *
 * @since 0.2.0
 */
export const lt =
  <CN extends string>(column: CN, value: unknown) =>
  <B extends { lt: (...args: any[]) => any }, E, R>(
    effect: Effect.Effect<B, E, R>
  ): Effect.Effect<B, E, R> =>
    Effect.map(effect, (builder) => builder.lt(column, value) as B);

/**
 * Filters rows where `column` is less than or equal to `value`.
 *
 * @param column - The column name to filter on.
 * @param value - The upper bound (inclusive).
 *
 * @since 0.2.0
 */
export const lte =
  <CN extends string>(column: CN, value: unknown) =>
  <B extends { lte: (...args: any[]) => any }, E, R>(
    effect: Effect.Effect<B, E, R>
  ): Effect.Effect<B, E, R> =>
    Effect.map(effect, (builder) => builder.lte(column, value) as B);

/**
 * Filters rows where `column` matches `pattern` using SQL `LIKE` (case-sensitive).
 *
 * @param column - The column name to filter on.
 * @param pattern - The SQL LIKE pattern.
 *
 * @since 0.2.0
 */
export const like =
  <CN extends string>(column: CN, pattern: string) =>
  <B extends { like: (...args: any[]) => any }, E, R>(
    effect: Effect.Effect<B, E, R>
  ): Effect.Effect<B, E, R> =>
    Effect.map(effect, (builder) => builder.like(column, pattern) as B);

/**
 * Filters rows where `column` matches `pattern` using SQL `ILIKE` (case-insensitive).
 *
 * @param column - The column name to filter on.
 * @param pattern - The SQL ILIKE pattern.
 *
 * @since 0.2.0
 */
export const ilike =
  <CN extends string>(column: CN, pattern: string) =>
  <B extends { ilike: (...args: any[]) => any }, E, R>(
    effect: Effect.Effect<B, E, R>
  ): Effect.Effect<B, E, R> =>
    Effect.map(effect, (builder) => builder.ilike(column, pattern) as B);

/**
 * Filters rows where `column` **is** the given value.
 * Typically used for checking `null`, `true`, or `false`.
 *
 * @param column - The column name to filter on.
 * @param value - Must be `null`, `true`, or `false`.
 *
 * @since 0.2.0
 */
export const is =
  <CN extends string>(column: CN, value: boolean | null) =>
  <B extends { is: (...args: any[]) => any }, E, R>(
    effect: Effect.Effect<B, E, R>
  ): Effect.Effect<B, E, R> =>
    Effect.map(effect, (builder) => builder.is(column, value) as B);

/**
 * Filters rows where `column` is in the given array of `values`.
 *
 * Named `in_` because `in` is a JavaScript reserved word.
 *
 * @param column - The column name to filter on.
 * @param values - An array of values to match against.
 *
 * @since 0.2.0
 */
export const in_ =
  <CN extends string>(column: CN, values: unknown[]) =>
  <B extends { in: (...args: any[]) => any }, E, R>(
    effect: Effect.Effect<B, E, R>
  ): Effect.Effect<B, E, R> =>
    Effect.map(effect, (builder) => builder.in(column, values) as B);

/**
 * Filters rows where `column` (a JSON, array, or range column) contains `value`.
 *
 * @param column - The column name to filter on.
 * @param value - The value that should be contained.
 *
 * @since 0.2.0
 */
export const contains =
  <CN extends string>(column: CN, value: unknown) =>
  <B extends { contains: (...args: any[]) => any }, E, R>(
    effect: Effect.Effect<B, E, R>
  ): Effect.Effect<B, E, R> =>
    Effect.map(effect, (builder) => builder.contains(column, value) as B);

/**
 * Filters rows where `column` (a JSON, array, or range column) is **contained by** `value`.
 * This is the inverse of {@link contains}.
 *
 * @param column - The column name to filter on.
 * @param value - The value that should contain the column's value.
 *
 * @since 0.2.0
 */
export const containedBy =
  <CN extends string>(column: CN, value: unknown) =>
  <B extends { containedBy: (...args: any[]) => any }, E, R>(
    effect: Effect.Effect<B, E, R>
  ): Effect.Effect<B, E, R> =>
    Effect.map(effect, (builder) => builder.containedBy(column, value) as B);

/**
 * Filters rows where `column` (an array or range column) overlaps with `value`.
 *
 * @param column - The column name to filter on.
 * @param value - The value to check overlap against.
 *
 * @since 0.2.0
 */
export const overlaps =
  <CN extends string>(column: CN, value: unknown) =>
  <B extends { overlaps: (...args: any[]) => any }, E, R>(
    effect: Effect.Effect<B, E, R>
  ): Effect.Effect<B, E, R> =>
    Effect.map(effect, (builder) => builder.overlaps(column, value) as B);

/**
 * Filters rows where `column` (a range column) is strictly greater than the given `range`.
 *
 * @param column - The range column name.
 * @param range - A PostgreSQL range literal (e.g. `"[1,5)"`).
 *
 * @since 0.2.0
 */
export const rangeGt =
  <CN extends string>(column: CN, range: string) =>
  <B extends { rangeGt: (...args: any[]) => any }, E, R>(
    effect: Effect.Effect<B, E, R>
  ): Effect.Effect<B, E, R> =>
    Effect.map(effect, (builder) => builder.rangeGt(column, range) as B);

/**
 * Filters rows where `column` (a range column) is greater than or equal to the given `range`.
 *
 * @param column - The range column name.
 * @param range - A PostgreSQL range literal.
 *
 * @since 0.2.0
 */
export const rangeGte =
  <CN extends string>(column: CN, range: string) =>
  <B extends { rangeGte: (...args: any[]) => any }, E, R>(
    effect: Effect.Effect<B, E, R>
  ): Effect.Effect<B, E, R> =>
    Effect.map(effect, (builder) => builder.rangeGte(column, range) as B);

/**
 * Filters rows where `column` (a range column) is strictly less than the given `range`.
 *
 * @param column - The range column name.
 * @param range - A PostgreSQL range literal.
 *
 * @since 0.2.0
 */
export const rangeLt =
  <CN extends string>(column: CN, range: string) =>
  <B extends { rangeLt: (...args: any[]) => any }, E, R>(
    effect: Effect.Effect<B, E, R>
  ): Effect.Effect<B, E, R> =>
    Effect.map(effect, (builder) => builder.rangeLt(column, range) as B);

/**
 * Filters rows where `column` (a range column) is less than or equal to the given `range`.
 *
 * @param column - The range column name.
 * @param range - A PostgreSQL range literal.
 *
 * @since 0.2.0
 */
export const rangeLte =
  <CN extends string>(column: CN, range: string) =>
  <B extends { rangeLte: (...args: any[]) => any }, E, R>(
    effect: Effect.Effect<B, E, R>
  ): Effect.Effect<B, E, R> =>
    Effect.map(effect, (builder) => builder.rangeLte(column, range) as B);

/**
 * Filters rows where `column` (a range column) is adjacent to the given `range`.
 *
 * @param column - The range column name.
 * @param range - A PostgreSQL range literal.
 *
 * @since 0.2.0
 */
export const rangeAdjacent =
  <CN extends string>(column: CN, range: string) =>
  <B extends { rangeAdjacent: (...args: any[]) => any }, E, R>(
    effect: Effect.Effect<B, E, R>
  ): Effect.Effect<B, E, R> =>
    Effect.map(effect, (builder) => builder.rangeAdjacent(column, range) as B);

/**
 * Performs a full-text search on `column` using the given `query`.
 *
 * @param column - The text or tsvector column to search.
 * @param query - The search query string.
 * @param options - Optional settings.
 * @param options.config - The text search configuration (e.g. `"english"`).
 * @param options.type - The query parsing type: `"plain"`, `"phrase"`, or `"websearch"`.
 *
 * @since 0.2.0
 */
export const textSearch =
  <CN extends string>(
    column: CN,
    query: string,
    options?: { config?: string; type?: "plain" | "phrase" | "websearch" }
  ) =>
  <B extends { textSearch: (...args: any[]) => any }, E, R>(
    effect: Effect.Effect<B, E, R>
  ): Effect.Effect<B, E, R> =>
    Effect.map(
      effect,
      (builder) => builder.textSearch(column, query, options) as B
    );

/**
 * Filters rows where **all** the given key-value pairs match.
 * Shorthand for chaining multiple {@link eq} calls.
 *
 * @param query - An object of column-value pairs to match.
 *
 * @since 0.2.0
 */
export const match =
  (query: Record<string, unknown>) =>
  <B extends { match: (...args: any[]) => any }, E, R>(
    effect: Effect.Effect<B, E, R>
  ): Effect.Effect<B, E, R> =>
    Effect.map(effect, (builder) => builder.match(query) as B);

/**
 * Negates a filter on `column` using the given PostgREST `operator`.
 *
 * @param column - The column name to filter on.
 * @param operator - The PostgREST operator to negate (e.g. `"eq"`, `"like"`, `"is"`).
 * @param value - The value for the negated filter.
 *
 * @since 0.2.0
 */
export const not =
  <CN extends string>(column: CN, operator: string, value: unknown) =>
  <B extends { not: (...args: any[]) => any }, E, R>(
    effect: Effect.Effect<B, E, R>
  ): Effect.Effect<B, E, R> =>
    Effect.map(effect, (builder) => builder.not(column, operator, value) as B);

/**
 * Combines multiple filters with a logical `OR`.
 *
 * @param filters - A PostgREST filter string (e.g. `"role.eq.admin,role.eq.moderator"`).
 * @param options - Optional settings.
 * @param options.referencedTable - Apply the OR filter on a referenced (joined) table.
 *
 * @since 0.2.0
 */
export const or =
  (filters: string, options?: { referencedTable?: string }) =>
  <B extends { or: (...args: any[]) => any }, E, R>(
    effect: Effect.Effect<B, E, R>
  ): Effect.Effect<B, E, R> =>
    Effect.map(effect, (builder) => builder.or(filters, options) as B);

/**
 * Applies a raw PostgREST filter on `column`.
 *
 * Use this for operators not covered by the dedicated filter functions.
 *
 * @param column - The column name to filter on.
 * @param operator - The PostgREST operator string (e.g. `"eq"`, `"gte"`, `"in"`).
 * @param value - The filter value.
 *
 * @since 0.2.0
 */
export const filter =
  <CN extends string>(column: CN, operator: string, value: unknown) =>
  <B extends { filter: (...args: any[]) => any }, E, R>(
    effect: Effect.Effect<B, E, R>
  ): Effect.Effect<B, E, R> =>
    Effect.map(
      effect,
      (builder) => builder.filter(column, operator, value) as B
    );

// ---------------------------------------------------------------------------
// Transforms
// ---------------------------------------------------------------------------

/**
 * Orders the result by the given column.
 *
 * @param column - The column name to order by.
 * @param options - Optional settings.
 * @param options.ascending - Sort ascending if `true` (default), descending if `false`.
 * @param options.nullsFirst - Place `null` values first if `true`.
 * @param options.referencedTable - Apply ordering on a referenced (joined) table.
 *
 * @since 0.2.0
 */
export const order =
  (
    column: string,
    options?: {
      ascending?: boolean;
      nullsFirst?: boolean;
      referencedTable?: string;
    }
  ) =>
  <B extends { order: (...args: any[]) => any }, E, R>(
    effect: Effect.Effect<B, E, R>
  ): Effect.Effect<B, E, R> =>
    Effect.map(effect, (builder) => builder.order(column, options) as B);

/**
 * Limits the number of rows returned.
 *
 * @param count - The maximum number of rows to return.
 * @param options - Optional settings.
 * @param options.referencedTable - Apply the limit on a referenced (joined) table.
 *
 * @since 0.2.0
 */
export const limit =
  (count: number, options?: { referencedTable?: string }) =>
  <B extends { limit: (...args: any[]) => any }, E, R>(
    effect: Effect.Effect<B, E, R>
  ): Effect.Effect<B, E, R> =>
    Effect.map(effect, (builder) => builder.limit(count, options) as B);

/**
 * Limits the result to rows within the specified range (0-based, inclusive on both ends).
 *
 * @param from - The starting index (inclusive).
 * @param to - The ending index (inclusive).
 * @param options - Optional settings.
 * @param options.referencedTable - Apply the range on a referenced (joined) table.
 *
 * @since 0.2.0
 */
export const range =
  (from: number, to: number, options?: { referencedTable?: string }) =>
  <B extends { range: (...args: any[]) => any }, E, R>(
    effect: Effect.Effect<B, E, R>
  ): Effect.Effect<B, E, R> =>
    Effect.map(effect, (builder) => builder.range(from, to, options) as B);

/**
 * Narrows the builder result type to a **single row**.
 *
 * **Note:** In most cases, you should use {@link executeSingle} instead,
 * which automatically applies this transform. Only use `asSingle` when
 * you need raw execution with {@link execute}.
 *
 * @since 0.2.0
 */
export const asSingle =
  () =>
  <
    B extends PromiseLike<PostgrestResponse<any>> & {
      single: (...args: any[]) => any;
    },
    E,
    R,
  >(
    effect: Effect.Effect<B, E, R>
  ) =>
    Effect.map(
      effect,
      (builder) =>
        builder.single() as PromiseLike<PostgrestSingleResponse<InferRow<B>>>
    );

/**
 * Narrows the builder result type to a **nullable single row**.
 *
 * **Note:** In most cases, you should use {@link executeMaybeSingle} instead,
 * which automatically applies this transform. Only use `asMaybeSingle` when
 * you need raw execution with {@link execute}.
 *
 * @since 0.2.0
 */
export const asMaybeSingle =
  () =>
  <
    B extends PromiseLike<PostgrestResponse<any>> & {
      maybeSingle: (...args: any[]) => any;
    },
    E,
    R,
  >(
    effect: Effect.Effect<B, E, R>
  ) =>
    Effect.map(
      effect,
      (builder) =>
        builder.maybeSingle() as PromiseLike<
          PostgrestSingleResponse<InferRow<B> | null>
        >
    );

/**
 * Converts the result to CSV format.
 *
 * @since 0.2.0
 */
export const asCsv =
  () =>
  <B extends { csv: (...args: any[]) => any }, E, R>(
    effect: Effect.Effect<B, E, R>
  ) =>
    Effect.map(effect, (builder) => builder.csv() as ReturnType<B["csv"]>);

// ---------------------------------------------------------------------------
// Execution (effectful boundary)
// ---------------------------------------------------------------------------

/**
 * Executes a PostgREST builder, converting the `PromiseLike` into an `Effect`.
 *
 * This is the **effectful boundary** in the builder pipeline. All preceding
 * functions (`from`, `select`, `eq`, `order`, etc.) build up an `Effect`
 * containing the query builder — `execute` is where the network request
 * actually happens.
 *
 * The raw `PostgrestSingleResponse` is returned as-is. For automatic error
 * extraction and type mapping, use the convenience combinators
 * ({@link executeMultiple}, {@link executeSingle}, {@link executeMaybeSingle})
 * or manually pipe into functions from `pg-response`.
 *
 * @param effect - An `Effect` containing a `PromiseLike` PostgREST builder.
 * @returns An `Effect` that resolves to the raw `PostgrestSingleResponse`.
 *
 * @example
 * Fire-and-forget mutation:
 * ```ts
 * pipe(
 *   Postgrest.from<Database>()("users"),
 *   Postgrest.delete_(),
 *   Postgrest.eq("id", userId),
 *   Postgrest.execute,
 * )
 * ```
 *
 * @since 0.2.0
 */
export const execute = <Result, E, R>(
  effect: Effect.Effect<PromiseLike<PostgrestSingleResponse<Result>>, E, R>
): Effect.Effect<PostgrestSingleResponse<Result>, E, R> =>
  Effect.flatMap(effect, (builder) =>
    Effect.promise(() => builder.then((r) => r))
  );

// ---------------------------------------------------------------------------
// Convenience combinators (execute + response mapping)
// ---------------------------------------------------------------------------

/**
 * Executes a PostgREST query and returns an array of rows.
 *
 * Combines execution with automatic error extraction and array result mapping.
 *
 * @example
 * ```ts
 * pipe(
 *   Postgrest.from<Database>()("users"),
 *   Postgrest.select("id, name, email"),
 *   Postgrest.eq("active", true),
 *   Postgrest.order("name"),
 *   Postgrest.limit(10),
 *   Postgrest.executeMultiple(),
 * )
 * ```
 *
 * @since 0.2.0
 */
export const executeMultiple =
  () =>
  <T, E, R>(
    effect: Effect.Effect<PromiseLike<PostgrestResponse<T>>, E, R>
  ): Effect.Effect<T[], E | PostgrestError, R> =>
    pipe(
      effect,
      Effect.flatMap((builder) => Effect.promise(() => builder.then((r) => r))),
      Effect.flatMap((response) =>
        PgResponse.flatMapMultiple()(response as PostgrestResponse<T>)
      )
    );

/**
 * Executes a PostgREST query and validates the response with an Effect Schema.
 *
 * Use this when you want to decode raw database rows into validated domain types.
 * Fails the entire `Effect` if **any** row fails to decode.
 *
 * @param schema - A pure `Schema` to decode each row.
 * @param concurrency - Optional concurrency setting for parallel decoding.
 *
 * @see {@link executeFilterMapMultipleWithSchema} to silently filter out rows that fail to decode.
 *
 * @since 0.2.0
 */
export const executeMultipleWithSchema =
  <A, I = A>(
    schema: PureSchemaWithEncodedType<A, I>,
    concurrency?: Types.Concurrency
  ) =>
  <E, R>(
    effect: Effect.Effect<PromiseLike<PostgrestResponse<any>>, E, R>
  ): Effect.Effect<Array<A>, E | PostgrestError | Schema.SchemaError, R> =>
    pipe(
      effect,
      Effect.flatMap((builder) => Effect.promise(() => builder.then((r) => r))),
      Effect.flatMap((response) =>
        PgResponse.flatMapMultipleWithSchema(
          schema,
          concurrency
        )(response as PostgrestResponse<I>)
      )
    );

/**
 * Executes a PostgREST query with schema validation, **silently filtering out**
 * rows that fail to decode.
 *
 * Unlike {@link executeMultipleWithSchema}, this does not fail on decode errors —
 * invalid rows are simply excluded from the result.
 *
 * @param schema - A pure `Schema` to decode each row.
 * @param concurrency - Optional concurrency setting for parallel decoding.
 *
 * @see {@link executeMultipleWithSchema} to fail the `Effect` when any row fails to decode.
 *
 * @since 0.2.0
 */
export const executeFilterMapMultipleWithSchema =
  <A, I = A>(
    schema: PureSchemaWithEncodedType<A, I>,
    concurrency?: Types.Concurrency
  ) =>
  <E, R>(
    effect: Effect.Effect<PromiseLike<PostgrestResponse<any>>, E, R>
  ): Effect.Effect<Array<A>, E | PostgrestError, R> =>
    pipe(
      effect,
      Effect.flatMap((builder) => Effect.promise(() => builder.then((r) => r))),
      Effect.flatMap((response) =>
        PgResponse.filterMapMultipleWithSchema(
          schema,
          concurrency
        )(response as PostgrestResponse<I>)
      )
    );

/**
 * Executes a PostgREST query and returns a single row.
 *
 * Automatically applies `.single()` to the builder, so there's no need
 * to call {@link asSingle} first.
 *
 * Returns a failed `Effect` with `PostgrestError` if the query returns zero
 * or more than one row (PostgREST returns a 406 error in this case).
 *
 * @example
 * ```ts
 * pipe(
 *   Postgrest.from<Database>()("users"),
 *   Postgrest.select("id, name, email"),
 *   Postgrest.eq("id", userId),
 *   Postgrest.executeSingle(),
 * )
 * ```
 *
 * @since 0.2.0
 */
export const executeSingle =
  () =>
  <
    B extends PromiseLike<PostgrestResponse<any>> & {
      single: (...args: any[]) => any;
    },
    E,
    R,
  >(
    effect: Effect.Effect<B, E, R>
  ): Effect.Effect<InferRow<B>, E | PostgrestError, R> =>
    pipe(
      effect,
      Effect.flatMap((builder) =>
        Effect.promise(() => builder.single().then((r: any) => r))
      ),
      Effect.flatMap((response) =>
        PgResponse.flatMapSingle()(
          response as PostgrestSingleResponse<InferRow<B>>
        )
      )
    );

/**
 * Executes a PostgREST query and validates the single row response with an Effect Schema.
 *
 * Automatically applies `.single()` to the builder, so there's no need
 * to call {@link asSingle} first.
 *
 * @param schema - A pure `Schema` to decode the row.
 *
 * @since 0.2.0
 */
export const executeSingleWithSchema =
  <A, I = A>(schema: PureSchemaWithEncodedType<A, I>) =>
  <E, R>(
    effect: Effect.Effect<
      PromiseLike<PostgrestResponse<any>> & {
        single: (...args: any[]) => any;
      },
      E,
      R
    >
  ): Effect.Effect<A, E | PostgrestError | Schema.SchemaError, R> =>
    pipe(
      effect,
      Effect.flatMap((builder) =>
        Effect.promise(() => builder.single().then((r: any) => r))
      ),
      Effect.flatMap((response) =>
        PgResponse.flatMapSingleWithSchema(schema)(
          response as PostgrestSingleResponse<I>
        )
      )
    );

/**
 * Executes a PostgREST query and returns an optional row.
 *
 * Automatically applies `.maybeSingle()` to the builder, so there's no need
 * to call {@link asMaybeSingle} first.
 *
 * Returns `Option.some(data)` when a row is found, `Option.none()` when no row matches.
 *
 * @example
 * ```ts
 * pipe(
 *   Postgrest.from<Database>()("users"),
 *   Postgrest.select("id, name, email"),
 *   Postgrest.eq("email", email),
 *   Postgrest.executeMaybeSingle(),
 * )
 * ```
 *
 * @since 0.2.0
 */
export const executeMaybeSingle =
  () =>
  <
    B extends PromiseLike<PostgrestResponse<any>> & {
      maybeSingle: (...args: any[]) => any;
    },
    E,
    R,
  >(
    effect: Effect.Effect<B, E, R>
  ): Effect.Effect<Option.Option<InferRow<B>>, E | PostgrestError, R> =>
    pipe(
      effect,
      Effect.flatMap((builder) =>
        Effect.promise(() => builder.maybeSingle().then((r: any) => r))
      ),
      Effect.flatMap((response) =>
        PgResponse.flatMapNullable()(
          response as PostgrestMaybeSingleResponse<InferRow<B>>
        )
      )
    );

/**
 * Executes a PostgREST query and validates the optional row response with an Effect Schema.
 *
 * Automatically applies `.maybeSingle()` to the builder, so there's no need
 * to call {@link asMaybeSingle} first.
 *
 * Returns `Option.some(validatedData)` when a row is found and validates,
 * `Option.none()` when no row matches.
 *
 * @param schema - A pure `Schema` to decode the row (if present).
 *
 * @since 0.2.0
 */
export const executeMaybeSingleWithSchema =
  <A, I = A>(schema: PureSchemaWithEncodedType<A, I>) =>
  <E, R>(
    effect: Effect.Effect<
      PromiseLike<PostgrestResponse<any>> & {
        maybeSingle: (...args: any[]) => any;
      },
      E,
      R
    >
  ): Effect.Effect<
    Option.Option<A>,
    E | PostgrestError | Schema.SchemaError,
    R
  > =>
    pipe(
      effect,
      Effect.flatMap((builder) =>
        Effect.promise(() => builder.maybeSingle().then((r: any) => r))
      ),
      Effect.flatMap((response) =>
        PgResponse.flatMapNullableWithSchema(schema)(
          response as PostgrestMaybeSingleResponse<I>
        )
      )
    );
