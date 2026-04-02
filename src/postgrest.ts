/* eslint-disable @typescript-eslint/no-explicit-any */
// `any` is used intentionally in structural type constraints to avoid
// importing unexported internal types from @supabase/postgrest-js
// (GenericSchema, GenericTable, GenericView) which causes TypeScript OOM.

import { SupabaseClient } from "@supabase/supabase-js";
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
import { PostgrestError } from "./postgrest-error";
import * as PgResponse from "./pg-response";
import { PureSchemaWithEncodedType } from "./schema";

// Re-export so TypeScript registers `@supabase/postgrest-js` by its portable
// package name when emitting declaration files (prevents TS2742).
export type { PostgrestQueryBuilder } from "@supabase/postgrest-js";

// ---------------------------------------------------------------------------
// Helper types
// ---------------------------------------------------------------------------

type TableName<D> = Parameters<SupabaseClient<D>["from"]>[0];

// ---------------------------------------------------------------------------
// Builder entry point
// ---------------------------------------------------------------------------

/**
 * Maps a `SupabaseClient` to a `PostgrestQueryBuilder` for the given table.
 * This is the entry point for building PostgREST queries.
 *
 * This is a **pure** function — it does not execute any network request.
 * The query is only executed when passed to {@link execute}, or one of the
 * convenience combinators ({@link multiple}, {@link single}, {@link maybeSingle}, etc.).
 *
 * @param tableName - The name of the table or view to query.
 * @returns A curried function that accepts a `SupabaseClient` and returns a `PostgrestQueryBuilder`.
 *
 * @example
 * Selecting multiple rows:
 * ```ts
 * import { pipe } from "effect"
 * import * as Effect from "effect/Effect"
 * import * as Postgrest from "supabase-effect/postgrest"
 * import * as Client from "supabase-effect/client"
 *
 * Client.getClient().pipe(
 *   Effect.flatMap(client =>
 *     pipe(
 *       Postgrest.table("users")(client),
 *       Postgrest.select("id, name"),
 *       Postgrest.multiple(),
 *     )
 *   )
 * )
 * ```
 *
 * @example
 * Using with `Effect.map` for deferred execution:
 * ```ts
 * const queryBuilder = Client.getClient().pipe(
 *   Effect.map(
 *     Postgrest.table("posts"),
 *   ),
 * )
 * ```
 *
 * @since 0.2.0
 */
export const table =
  <D, T extends TableName<D>>(tableName: T) =>
  (client: SupabaseClient<D>) =>
    client.from(tableName);

// ---------------------------------------------------------------------------
// Query starters (pure)
// ---------------------------------------------------------------------------

/**
 * Maps a `PostgrestQueryBuilder` to a select query.
 *
 * The string literal type `Q` is captured at the type level, enabling Supabase's
 * built-in query parser to compute the exact result type from the column string.
 * For example, `select("id, name")` will infer a result type of `{ id: ...; name: ... }`.
 *
 * This is a **pure** function — it does not execute any network request.
 *
 * @param columns - A comma-separated string of columns to select, with support for
 *   embedded resources (e.g. `"id, name, posts(*)"`). Defaults to `"*"`.
 * @param options - Optional settings.
 * @param options.head - When `true`, performs a HEAD request (no response body, count only).
 * @param options.count - Count algorithm to use: `"exact"`, `"planned"`, or `"estimated"`.
 *
 * @example
 * Select all columns:
 * ```ts
 * pipe(
 *   Postgrest.table("users")(client),
 *   Postgrest.select(),
 *   Postgrest.multiple(),
 * )
 * ```
 *
 * @example
 * Select specific columns with embedded relations:
 * ```ts
 * pipe(
 *   Postgrest.table("users")(client),
 *   Postgrest.select("id, name, posts(id, title)"),
 *   Postgrest.multiple(),
 * )
 * ```
 *
 * @example
 * Select with count:
 * ```ts
 * pipe(
 *   Postgrest.table("users")(client),
 *   Postgrest.select("*", { count: "exact", head: true }),
 *   Postgrest.execute,
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
  <QB extends { select: (...args: any[]) => any }>(qb: QB) =>
    qb.select(columns, options) as ReturnType<QB["select"]>;

/**
 * Maps a `PostgrestQueryBuilder` to an insert operation.
 *
 * This is a **pure** function — it does not execute any network request.
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
 *   Postgrest.table("users")(client),
 *   Postgrest.insert({ name: "Alice", email: "alice@example.com" }),
 *   Postgrest.execute,
 * )
 * ```
 *
 * @example
 * Insert and return the created row:
 * ```ts
 * pipe(
 *   Postgrest.table("users")(client),
 *   Postgrest.insert({ name: "Alice", email: "alice@example.com" }),
 *   Postgrest.select("id, name"),
 *   Postgrest.asSingle(),
 *   Postgrest.single(),
 * )
 * ```
 *
 * @example
 * Bulk insert multiple rows:
 * ```ts
 * pipe(
 *   Postgrest.table("users")(client),
 *   Postgrest.insert([
 *     { name: "Alice", email: "alice@example.com" },
 *     { name: "Bob", email: "bob@example.com" },
 *   ]),
 *   Postgrest.select("id, name"),
 *   Postgrest.multiple(),
 * )
 * ```
 *
 * @since 0.2.0
 */
export const insert =
  (
    values: unknown,
    options?: {
      count?: "exact" | "planned" | "estimated";
      defaultToNull?: boolean;
    }
  ) =>
  <QB extends { insert: (...args: any[]) => any }>(qb: QB) =>
    qb.insert(values, options) as ReturnType<QB["insert"]>;

/**
 * Maps a `PostgrestQueryBuilder` to an update operation.
 *
 * This is a **pure** function — it does not execute any network request.
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
 *   Postgrest.table("users")(client),
 *   Postgrest.update({ name: "Alice Updated" }),
 *   Postgrest.eq("id", userId),
 *   Postgrest.execute,
 * )
 * ```
 *
 * @example
 * Update and return the modified row:
 * ```ts
 * pipe(
 *   Postgrest.table("users")(client),
 *   Postgrest.update({ name: "Alice Updated" }),
 *   Postgrest.eq("id", userId),
 *   Postgrest.select("id, name"),
 *   Postgrest.asSingle(),
 *   Postgrest.single(),
 * )
 * ```
 *
 * @since 0.2.0
 */
export const update =
  (values: unknown, options?: { count?: "exact" | "planned" | "estimated" }) =>
  <QB extends { update: (...args: any[]) => any }>(qb: QB) =>
    qb.update(values, options) as ReturnType<QB["update"]>;

/**
 * Maps a `PostgrestQueryBuilder` to an upsert operation.
 *
 * Upsert inserts rows if they don't exist, or updates them if they conflict
 * on the specified constraint.
 *
 * This is a **pure** function — it does not execute any network request.
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
 *   Postgrest.table("users")(client),
 *   Postgrest.upsert(
 *     { email: "alice@example.com", name: "Alice" },
 *     { onConflict: "email" },
 *   ),
 *   Postgrest.select("id, name, email"),
 *   Postgrest.asSingle(),
 *   Postgrest.single(),
 * )
 * ```
 *
 * @since 0.2.0
 */
export const upsert =
  (
    values: unknown,
    options?: {
      onConflict?: string;
      ignoreDuplicates?: boolean;
      count?: "exact" | "planned" | "estimated";
      defaultToNull?: boolean;
    }
  ) =>
  <QB extends { upsert: (...args: any[]) => any }>(qb: QB) =>
    qb.upsert(values, options) as ReturnType<QB["upsert"]>;

/**
 * Maps a `PostgrestQueryBuilder` to a delete operation.
 *
 * Named `delete_` because `delete` is a JavaScript reserved word.
 *
 * This is a **pure** function — it does not execute any network request.
 * Always chain with a filter (e.g. {@link eq}) to target specific rows.
 *
 * @param options - Optional settings.
 * @param options.count - Count algorithm to use.
 *
 * @example
 * Delete a user by id:
 * ```ts
 * pipe(
 *   Postgrest.table("users")(client),
 *   Postgrest.delete_(),
 *   Postgrest.eq("id", userId),
 *   Postgrest.execute,
 * )
 * ```
 *
 * @example
 * Delete and return the removed row:
 * ```ts
 * pipe(
 *   Postgrest.table("users")(client),
 *   Postgrest.delete_(),
 *   Postgrest.eq("id", userId),
 *   Postgrest.select("id, name"),
 *   Postgrest.asSingle(),
 *   Postgrest.single(),
 * )
 * ```
 *
 * @since 0.2.0
 */
export const delete_ =
  (options?: { count?: "exact" | "planned" | "estimated" }) =>
  <QB extends { delete: (...args: any[]) => any }>(qb: QB) =>
    qb.delete(options) as ReturnType<QB["delete"]>;

// ---------------------------------------------------------------------------
// Filters (pure, preserves builder type via `as B`)
// ---------------------------------------------------------------------------

/**
 * Filters rows where `column` equals `value`.
 *
 * All filter functions are **pure** — they return the same builder type to
 * allow further chaining. The builder is only executed when passed to
 * {@link execute} or a convenience combinator.
 *
 * @param column - The column name to filter on.
 * @param value - The value to compare against.
 *
 * @example
 * ```ts
 * pipe(
 *   Postgrest.table("users")(client),
 *   Postgrest.select("id, name"),
 *   Postgrest.eq("id", 42),
 *   Postgrest.single(),
 * )
 * ```
 *
 * @since 0.2.0
 */
export const eq =
  <CN extends string>(column: CN, value: unknown) =>
  <B extends { eq: (...args: any[]) => any }>(builder: B): B =>
    builder.eq(column, value) as B;

/**
 * Filters rows where `column` does **not** equal `value`.
 *
 * @param column - The column name to filter on.
 * @param value - The value to exclude.
 *
 * @example
 * ```ts
 * pipe(
 *   Postgrest.table("users")(client),
 *   Postgrest.select("id, name"),
 *   Postgrest.neq("role", "admin"),
 *   Postgrest.multiple(),
 * )
 * ```
 *
 * @since 0.2.0
 */
export const neq =
  <CN extends string>(column: CN, value: unknown) =>
  <B extends { neq: (...args: any[]) => any }>(builder: B): B =>
    builder.neq(column, value) as B;

/**
 * Filters rows where `column` is greater than `value`.
 *
 * @param column - The column name to filter on.
 * @param value - The lower bound (exclusive).
 *
 * @example
 * ```ts
 * pipe(
 *   Postgrest.table("orders")(client),
 *   Postgrest.select("id, total"),
 *   Postgrest.gt("total", 100),
 *   Postgrest.multiple(),
 * )
 * ```
 *
 * @since 0.2.0
 */
export const gt =
  <CN extends string>(column: CN, value: unknown) =>
  <B extends { gt: (...args: any[]) => any }>(builder: B): B =>
    builder.gt(column, value) as B;

/**
 * Filters rows where `column` is greater than or equal to `value`.
 *
 * @param column - The column name to filter on.
 * @param value - The lower bound (inclusive).
 *
 * @example
 * ```ts
 * pipe(
 *   Postgrest.table("products")(client),
 *   Postgrest.select("id, name, price"),
 *   Postgrest.gte("price", 10),
 *   Postgrest.multiple(),
 * )
 * ```
 *
 * @since 0.2.0
 */
export const gte =
  <CN extends string>(column: CN, value: unknown) =>
  <B extends { gte: (...args: any[]) => any }>(builder: B): B =>
    builder.gte(column, value) as B;

/**
 * Filters rows where `column` is less than `value`.
 *
 * @param column - The column name to filter on.
 * @param value - The upper bound (exclusive).
 *
 * @example
 * ```ts
 * pipe(
 *   Postgrest.table("products")(client),
 *   Postgrest.select("id, name, price"),
 *   Postgrest.lt("price", 50),
 *   Postgrest.multiple(),
 * )
 * ```
 *
 * @since 0.2.0
 */
export const lt =
  <CN extends string>(column: CN, value: unknown) =>
  <B extends { lt: (...args: any[]) => any }>(builder: B): B =>
    builder.lt(column, value) as B;

/**
 * Filters rows where `column` is less than or equal to `value`.
 *
 * @param column - The column name to filter on.
 * @param value - The upper bound (inclusive).
 *
 * @example
 * ```ts
 * pipe(
 *   Postgrest.table("products")(client),
 *   Postgrest.select("id, name, stock"),
 *   Postgrest.lte("stock", 5),
 *   Postgrest.multiple(),
 * )
 * ```
 *
 * @since 0.2.0
 */
export const lte =
  <CN extends string>(column: CN, value: unknown) =>
  <B extends { lte: (...args: any[]) => any }>(builder: B): B =>
    builder.lte(column, value) as B;

/**
 * Filters rows where `column` matches `pattern` using SQL `LIKE` (case-sensitive).
 *
 * Use `%` as a wildcard for any sequence of characters and `_` for a single character.
 *
 * @param column - The column name to filter on.
 * @param pattern - The SQL LIKE pattern.
 *
 * @example
 * ```ts
 * pipe(
 *   Postgrest.table("users")(client),
 *   Postgrest.select("id, name"),
 *   Postgrest.like("name", "A%"),
 *   Postgrest.multiple(),
 * )
 * ```
 *
 * @since 0.2.0
 */
export const like =
  <CN extends string>(column: CN, pattern: string) =>
  <B extends { like: (...args: any[]) => any }>(builder: B): B =>
    builder.like(column, pattern) as B;

/**
 * Filters rows where `column` matches `pattern` using SQL `ILIKE` (case-insensitive).
 *
 * Use `%` as a wildcard for any sequence of characters and `_` for a single character.
 *
 * @param column - The column name to filter on.
 * @param pattern - The SQL ILIKE pattern.
 *
 * @example
 * ```ts
 * pipe(
 *   Postgrest.table("users")(client),
 *   Postgrest.select("id, email"),
 *   Postgrest.ilike("email", "%@example.com"),
 *   Postgrest.multiple(),
 * )
 * ```
 *
 * @since 0.2.0
 */
export const ilike =
  <CN extends string>(column: CN, pattern: string) =>
  <B extends { ilike: (...args: any[]) => any }>(builder: B): B =>
    builder.ilike(column, pattern) as B;

/**
 * Filters rows where `column` **is** the given value.
 * Typically used for checking `null`, `true`, or `false`.
 *
 * @param column - The column name to filter on.
 * @param value - Must be `null`, `true`, or `false`.
 *
 * @example
 * Filter for null values:
 * ```ts
 * pipe(
 *   Postgrest.table("users")(client),
 *   Postgrest.select("id, name"),
 *   Postgrest.is("deleted_at", null),
 *   Postgrest.multiple(),
 * )
 * ```
 *
 * @example
 * Filter for boolean values:
 * ```ts
 * pipe(
 *   Postgrest.table("users")(client),
 *   Postgrest.select("id, name"),
 *   Postgrest.is("active", true),
 *   Postgrest.multiple(),
 * )
 * ```
 *
 * @since 0.2.0
 */
export const is =
  <CN extends string>(column: CN, value: boolean | null) =>
  <B extends { is: (...args: any[]) => any }>(builder: B): B =>
    builder.is(column, value) as B;

/**
 * Filters rows where `column` is in the given array of `values`.
 *
 * Named `in_` because `in` is a JavaScript reserved word.
 *
 * @param column - The column name to filter on.
 * @param values - An array of values to match against.
 *
 * @example
 * ```ts
 * pipe(
 *   Postgrest.table("users")(client),
 *   Postgrest.select("id, name, role"),
 *   Postgrest.in_("role", ["admin", "moderator"]),
 *   Postgrest.multiple(),
 * )
 * ```
 *
 * @since 0.2.0
 */
export const in_ =
  <CN extends string>(column: CN, values: unknown[]) =>
  <B extends { in: (...args: any[]) => any }>(builder: B): B =>
    builder.in(column, values) as B;

/**
 * Filters rows where `column` (a JSON, array, or range column) contains `value`.
 *
 * @param column - The column name to filter on.
 * @param value - The value that should be contained.
 *
 * @example
 * Filter rows where the `tags` array contains a specific tag:
 * ```ts
 * pipe(
 *   Postgrest.table("posts")(client),
 *   Postgrest.select("id, title, tags"),
 *   Postgrest.contains("tags", ["typescript"]),
 *   Postgrest.multiple(),
 * )
 * ```
 *
 * @example
 * Filter rows where a JSONB column contains a given object:
 * ```ts
 * pipe(
 *   Postgrest.table("profiles")(client),
 *   Postgrest.select("id, metadata"),
 *   Postgrest.contains("metadata", { plan: "pro" }),
 *   Postgrest.multiple(),
 * )
 * ```
 *
 * @since 0.2.0
 */
export const contains =
  <CN extends string>(column: CN, value: unknown) =>
  <B extends { contains: (...args: any[]) => any }>(builder: B): B =>
    builder.contains(column, value) as B;

/**
 * Filters rows where `column` (a JSON, array, or range column) is **contained by** `value`.
 * This is the inverse of {@link contains}.
 *
 * @param column - The column name to filter on.
 * @param value - The value that should contain the column's value.
 *
 * @example
 * ```ts
 * pipe(
 *   Postgrest.table("posts")(client),
 *   Postgrest.select("id, title, tags"),
 *   Postgrest.containedBy("tags", ["typescript", "effect", "supabase", "react"]),
 *   Postgrest.multiple(),
 * )
 * ```
 *
 * @since 0.2.0
 */
export const containedBy =
  <CN extends string>(column: CN, value: unknown) =>
  <B extends { containedBy: (...args: any[]) => any }>(builder: B): B =>
    builder.containedBy(column, value) as B;

/**
 * Filters rows where `column` (an array or range column) overlaps with `value`.
 *
 * @param column - The column name to filter on.
 * @param value - The value to check overlap against.
 *
 * @example
 * ```ts
 * pipe(
 *   Postgrest.table("events")(client),
 *   Postgrest.select("id, name, days"),
 *   Postgrest.overlaps("days", ["monday", "wednesday"]),
 *   Postgrest.multiple(),
 * )
 * ```
 *
 * @since 0.2.0
 */
export const overlaps =
  <CN extends string>(column: CN, value: unknown) =>
  <B extends { overlaps: (...args: any[]) => any }>(builder: B): B =>
    builder.overlaps(column, value) as B;

/**
 * Filters rows where `column` (a range column) is strictly greater than the given `range`.
 *
 * @param column - The range column name.
 * @param range - A PostgreSQL range literal (e.g. `"[1,5)"`).
 *
 * @example
 * ```ts
 * pipe(
 *   Postgrest.table("reservations")(client),
 *   Postgrest.select("id, time_range"),
 *   Postgrest.rangeGt("time_range", "[2024-01-01,2024-02-01)"),
 *   Postgrest.multiple(),
 * )
 * ```
 *
 * @since 0.2.0
 */
export const rangeGt =
  <CN extends string>(column: CN, range: string) =>
  <B extends { rangeGt: (...args: any[]) => any }>(builder: B): B =>
    builder.rangeGt(column, range) as B;

/**
 * Filters rows where `column` (a range column) is greater than or equal to the given `range`.
 *
 * @param column - The range column name.
 * @param range - A PostgreSQL range literal.
 *
 * @example
 * ```ts
 * pipe(
 *   Postgrest.table("reservations")(client),
 *   Postgrest.select("id, time_range"),
 *   Postgrest.rangeGte("time_range", "[2024-01-01,2024-02-01)"),
 *   Postgrest.multiple(),
 * )
 * ```
 *
 * @since 0.2.0
 */
export const rangeGte =
  <CN extends string>(column: CN, range: string) =>
  <B extends { rangeGte: (...args: any[]) => any }>(builder: B): B =>
    builder.rangeGte(column, range) as B;

/**
 * Filters rows where `column` (a range column) is strictly less than the given `range`.
 *
 * @param column - The range column name.
 * @param range - A PostgreSQL range literal.
 *
 * @example
 * ```ts
 * pipe(
 *   Postgrest.table("reservations")(client),
 *   Postgrest.select("id, time_range"),
 *   Postgrest.rangeLt("time_range", "[2024-06-01,2024-07-01)"),
 *   Postgrest.multiple(),
 * )
 * ```
 *
 * @since 0.2.0
 */
export const rangeLt =
  <CN extends string>(column: CN, range: string) =>
  <B extends { rangeLt: (...args: any[]) => any }>(builder: B): B =>
    builder.rangeLt(column, range) as B;

/**
 * Filters rows where `column` (a range column) is less than or equal to the given `range`.
 *
 * @param column - The range column name.
 * @param range - A PostgreSQL range literal.
 *
 * @example
 * ```ts
 * pipe(
 *   Postgrest.table("reservations")(client),
 *   Postgrest.select("id, time_range"),
 *   Postgrest.rangeLte("time_range", "[2024-06-01,2024-07-01)"),
 *   Postgrest.multiple(),
 * )
 * ```
 *
 * @since 0.2.0
 */
export const rangeLte =
  <CN extends string>(column: CN, range: string) =>
  <B extends { rangeLte: (...args: any[]) => any }>(builder: B): B =>
    builder.rangeLte(column, range) as B;

/**
 * Filters rows where `column` (a range column) is adjacent to the given `range`.
 *
 * @param column - The range column name.
 * @param range - A PostgreSQL range literal.
 *
 * @example
 * ```ts
 * pipe(
 *   Postgrest.table("reservations")(client),
 *   Postgrest.select("id, time_range"),
 *   Postgrest.rangeAdjacent("time_range", "[2024-01-01,2024-02-01)"),
 *   Postgrest.multiple(),
 * )
 * ```
 *
 * @since 0.2.0
 */
export const rangeAdjacent =
  <CN extends string>(column: CN, range: string) =>
  <B extends { rangeAdjacent: (...args: any[]) => any }>(builder: B): B =>
    builder.rangeAdjacent(column, range) as B;

/**
 * Performs a full-text search on `column` using the given `query`.
 *
 * @param column - The text or tsvector column to search.
 * @param query - The search query string.
 * @param options - Optional settings.
 * @param options.config - The text search configuration (e.g. `"english"`).
 * @param options.type - The query parsing type: `"plain"`, `"phrase"`, or `"websearch"`.
 *
 * @example
 * Basic full-text search:
 * ```ts
 * pipe(
 *   Postgrest.table("posts")(client),
 *   Postgrest.select("id, title, body"),
 *   Postgrest.textSearch("body", "effect & supabase"),
 *   Postgrest.multiple(),
 * )
 * ```
 *
 * @example
 * Websearch-style query with language config:
 * ```ts
 * pipe(
 *   Postgrest.table("posts")(client),
 *   Postgrest.select("id, title"),
 *   Postgrest.textSearch("body", "effect supabase", {
 *     type: "websearch",
 *     config: "english",
 *   }),
 *   Postgrest.multiple(),
 * )
 * ```
 *
 * @since 0.2.0
 */
export const textSearch =
  <CN extends string>(
    column: CN,
    query: string,
    options?: { config?: string; type?: "plain" | "phrase" | "websearch" }
  ) =>
  <B extends { textSearch: (...args: any[]) => any }>(builder: B): B =>
    builder.textSearch(column, query, options) as B;

/**
 * Filters rows where **all** the given key-value pairs match.
 * Shorthand for chaining multiple {@link eq} calls.
 *
 * @param query - An object of column-value pairs to match.
 *
 * @example
 * ```ts
 * pipe(
 *   Postgrest.table("users")(client),
 *   Postgrest.select("id, name"),
 *   Postgrest.match({ role: "admin", active: true }),
 *   Postgrest.multiple(),
 * )
 * ```
 *
 * @since 0.2.0
 */
export const match =
  (query: Record<string, unknown>) =>
  <B extends { match: (...args: any[]) => any }>(builder: B): B =>
    builder.match(query) as B;

/**
 * Negates a filter on `column` using the given PostgREST `operator`.
 *
 * @param column - The column name to filter on.
 * @param operator - The PostgREST operator to negate (e.g. `"eq"`, `"like"`, `"is"`).
 * @param value - The value for the negated filter.
 *
 * @example
 * Find users whose name is **not** null:
 * ```ts
 * pipe(
 *   Postgrest.table("users")(client),
 *   Postgrest.select("id, name"),
 *   Postgrest.not("name", "is", null),
 *   Postgrest.multiple(),
 * )
 * ```
 *
 * @since 0.2.0
 */
export const not =
  <CN extends string>(column: CN, operator: string, value: unknown) =>
  <B extends { not: (...args: any[]) => any }>(builder: B): B =>
    builder.not(column, operator, value) as B;

/**
 * Combines multiple filters with a logical `OR`.
 *
 * @param filters - A PostgREST filter string (e.g. `"role.eq.admin,role.eq.moderator"`).
 * @param options - Optional settings.
 * @param options.referencedTable - Apply the OR filter on a referenced (joined) table.
 *
 * @example
 * ```ts
 * pipe(
 *   Postgrest.table("users")(client),
 *   Postgrest.select("id, name, role"),
 *   Postgrest.or("role.eq.admin,role.eq.moderator"),
 *   Postgrest.multiple(),
 * )
 * ```
 *
 * @example
 * OR filter on a referenced table:
 * ```ts
 * pipe(
 *   Postgrest.table("users")(client),
 *   Postgrest.select("id, name, posts(id, status)"),
 *   Postgrest.or("status.eq.published,status.eq.draft", {
 *     referencedTable: "posts",
 *   }),
 *   Postgrest.multiple(),
 * )
 * ```
 *
 * @since 0.2.0
 */
export const or =
  (filters: string, options?: { referencedTable?: string }) =>
  <B extends { or: (...args: any[]) => any }>(builder: B): B =>
    builder.or(filters, options) as B;

/**
 * Applies a raw PostgREST filter on `column`.
 *
 * Use this for operators not covered by the dedicated filter functions.
 *
 * @param column - The column name to filter on.
 * @param operator - The PostgREST operator string (e.g. `"eq"`, `"gte"`, `"in"`).
 * @param value - The filter value.
 *
 * @example
 * ```ts
 * pipe(
 *   Postgrest.table("users")(client),
 *   Postgrest.select("id, name"),
 *   Postgrest.filter("age", "gte", 18),
 *   Postgrest.multiple(),
 * )
 * ```
 *
 * @since 0.2.0
 */
export const filter =
  <CN extends string>(column: CN, operator: string, value: unknown) =>
  <B extends { filter: (...args: any[]) => any }>(builder: B): B =>
    builder.filter(column, operator, value) as B;

// ---------------------------------------------------------------------------
// Transforms (pure)
// ---------------------------------------------------------------------------

/**
 * Orders the result by the given column.
 *
 * This is a **pure** transform — it does not execute the query.
 *
 * @param column - The column name to order by.
 * @param options - Optional settings.
 * @param options.ascending - Sort ascending if `true` (default), descending if `false`.
 * @param options.nullsFirst - Place `null` values first if `true`.
 * @param options.referencedTable - Apply ordering on a referenced (joined) table.
 *
 * @example
 * Order by name ascending (default):
 * ```ts
 * pipe(
 *   Postgrest.table("users")(client),
 *   Postgrest.select("id, name"),
 *   Postgrest.order("name"),
 *   Postgrest.multiple(),
 * )
 * ```
 *
 * @example
 * Order by creation date descending, nulls last:
 * ```ts
 * pipe(
 *   Postgrest.table("posts")(client),
 *   Postgrest.select("id, title, created_at"),
 *   Postgrest.order("created_at", { ascending: false }),
 *   Postgrest.multiple(),
 * )
 * ```
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
  <B extends { order: (...args: any[]) => any }>(builder: B): B =>
    builder.order(column, options) as B;

/**
 * Limits the number of rows returned.
 *
 * This is a **pure** transform — it does not execute the query.
 *
 * @param count - The maximum number of rows to return.
 * @param options - Optional settings.
 * @param options.referencedTable - Apply the limit on a referenced (joined) table.
 *
 * @example
 * ```ts
 * pipe(
 *   Postgrest.table("posts")(client),
 *   Postgrest.select("id, title"),
 *   Postgrest.order("created_at", { ascending: false }),
 *   Postgrest.limit(10),
 *   Postgrest.multiple(),
 * )
 * ```
 *
 * @since 0.2.0
 */
export const limit =
  (count: number, options?: { referencedTable?: string }) =>
  <B extends { limit: (...args: any[]) => any }>(builder: B): B =>
    builder.limit(count, options) as B;

/**
 * Limits the result to rows within the specified range (0-based, inclusive on both ends).
 *
 * This is a **pure** transform — it does not execute the query.
 *
 * @param from - The starting index (inclusive).
 * @param to - The ending index (inclusive).
 * @param options - Optional settings.
 * @param options.referencedTable - Apply the range on a referenced (joined) table.
 *
 * @example
 * Pagination — get rows 10 to 19:
 * ```ts
 * pipe(
 *   Postgrest.table("posts")(client),
 *   Postgrest.select("id, title"),
 *   Postgrest.order("created_at", { ascending: false }),
 *   Postgrest.range(10, 19),
 *   Postgrest.multiple(),
 * )
 * ```
 *
 * @since 0.2.0
 */
export const range =
  (from: number, to: number, options?: { referencedTable?: string }) =>
  <B extends { range: (...args: any[]) => any }>(builder: B): B =>
    builder.range(from, to, options) as B;

/**
 * Narrows the builder result type to a **single row**.
 *
 * Named `asSingle` to distinguish from the convenience combinator {@link single},
 * which combines this transform with execution and response mapping.
 *
 * This is a **pure** transform — it does not execute the query.
 * The query will return a 406 error if the result contains zero or more than one row.
 *
 * @example
 * Using `asSingle` with {@link execute}:
 * ```ts
 * pipe(
 *   Postgrest.table("users")(client),
 *   Postgrest.select("id, name"),
 *   Postgrest.eq("id", userId),
 *   Postgrest.asSingle(),
 *   Postgrest.execute,
 * )
 * ```
 *
 * @example
 * Prefer using the {@link single} convenience combinator instead:
 * ```ts
 * pipe(
 *   Postgrest.table("users")(client),
 *   Postgrest.select("id, name"),
 *   Postgrest.eq("id", userId),
 *   Postgrest.asSingle(),
 *   Postgrest.single(),
 * )
 * ```
 *
 * @since 0.2.0
 */
export const asSingle =
  () =>
  <B extends { single: (...args: any[]) => any }>(builder: B) =>
    builder.single() as ReturnType<B["single"]>;

/**
 * Narrows the builder result type to a **nullable single row**.
 *
 * Named `asMaybeSingle` to distinguish from the convenience combinator {@link maybeSingle},
 * which combines this transform with execution and response mapping.
 *
 * This is a **pure** transform — it does not execute the query.
 * Returns `null` in the data field if no rows match.
 *
 * @example
 * Using `asMaybeSingle` with {@link execute}:
 * ```ts
 * pipe(
 *   Postgrest.table("users")(client),
 *   Postgrest.select("id, name"),
 *   Postgrest.eq("email", email),
 *   Postgrest.asMaybeSingle(),
 *   Postgrest.execute,
 * )
 * ```
 *
 * @since 0.2.0
 */
export const asMaybeSingle =
  () =>
  <B extends { maybeSingle: (...args: any[]) => any }>(builder: B) =>
    builder.maybeSingle() as ReturnType<B["maybeSingle"]>;

/**
 * Converts the result to CSV format.
 *
 * This is a **pure** transform — it does not execute the query.
 *
 * @example
 * ```ts
 * pipe(
 *   Postgrest.table("users")(client),
 *   Postgrest.select("id, name, email"),
 *   Postgrest.asCsv(),
 *   Postgrest.execute,
 * )
 * ```
 *
 * @since 0.2.0
 */
export const asCsv =
  () =>
  <B extends { csv: (...args: any[]) => any }>(builder: B) =>
    builder.csv() as ReturnType<B["csv"]>;

// ---------------------------------------------------------------------------
// Execution (effectful boundary)
// ---------------------------------------------------------------------------

/**
 * Executes a PostgREST builder, converting the `PromiseLike` into an `Effect`.
 *
 * This is the **single effectful boundary** in the builder pipeline. All preceding
 * functions (`table`, `select`, `eq`, `order`, etc.) are pure — `execute` is where
 * the network request actually happens.
 *
 * The raw `PostgrestSingleResponse` is returned as-is. For automatic error extraction
 * and type mapping, use the convenience combinators ({@link multiple}, {@link single},
 * {@link maybeSingle}) or manually pipe into functions from `pg-response`.
 *
 * @param builder - A `PromiseLike` PostgREST builder (any builder after a query starter).
 * @returns An `Effect` that resolves to the raw `PostgrestSingleResponse`.
 *
 * @example
 * Low-level usage with manual response handling:
 * ```ts
 * import * as PgResponse from "supabase-effect/postgrest-response"
 *
 * pipe(
 *   Postgrest.table("users")(client),
 *   Postgrest.select("id, name"),
 *   Postgrest.execute,
 *   Effect.flatMap(PgResponse.flatMapMultiple()),
 * )
 * ```
 *
 * @example
 * Fire-and-forget mutation (no response data needed):
 * ```ts
 * pipe(
 *   Postgrest.table("users")(client),
 *   Postgrest.delete_(),
 *   Postgrest.eq("id", userId),
 *   Postgrest.execute,
 * )
 * ```
 *
 * @since 0.2.0
 */
export const execute = <Result>(
  builder: PromiseLike<PostgrestSingleResponse<Result>>
): Effect.Effect<PostgrestSingleResponse<Result>> =>
  Effect.promise(() => builder.then((r) => r));

// ---------------------------------------------------------------------------
// Convenience combinators (execute + response mapping)
// ---------------------------------------------------------------------------

/**
 * Executes the builder and maps the response to `Effect<T[], PostgrestError>`.
 *
 * This is a convenience combinator that combines {@link execute} with
 * `PgResponse.flatMapMultiple()`. Use it at the end of a `select` pipeline
 * that returns multiple rows.
 *
 * @returns A function that takes a builder and returns an `Effect` with the decoded rows.
 *
 * @example
 * Basic usage:
 * ```ts
 * Client.getClient().pipe(
 *   Effect.flatMap(client =>
 *     pipe(
 *       Postgrest.table("users")(client),
 *       Postgrest.select("id, name, email"),
 *       Postgrest.eq("active", true),
 *       Postgrest.order("name"),
 *       Postgrest.limit(10),
 *       Postgrest.multiple(),
 *     )
 *   )
 * )
 * ```
 *
 * @since 0.2.0
 */
export const multiple =
  () =>
  <Result>(
    builder: PromiseLike<PostgrestResponse<Result>>
  ): Effect.Effect<Array<Result>, PostgrestError> =>
    pipe(
      Effect.promise(() => builder.then((r) => r)),
      Effect.flatMap(PgResponse.flatMapMultiple())
    );

/**
 * Executes the builder and maps the response with schema decoding to
 * `Effect<A[], PostgrestError | SchemaError>`.
 *
 * Use this when you want to decode raw database rows into validated domain types.
 * Fails the entire `Effect` if **any** row fails to decode.
 *
 * @param schema - A pure `Schema` to decode each row.
 * @param concurrency - Optional concurrency setting for parallel decoding.
 *
 * @see {@link filterMapMultipleWithSchema} to silently filter out rows that fail to decode.
 *
 * @example
 * ```ts
 * import * as Schema from "effect/Schema"
 *
 * const User = Schema.Struct({
 *   id: Schema.Number,
 *   name: Schema.String,
 *   email: Schema.String,
 * })
 *
 * Client.getClient().pipe(
 *   Effect.flatMap(client =>
 *     pipe(
 *       Postgrest.table("users")(client),
 *       Postgrest.select("id, name, email"),
 *       Postgrest.multipleWithSchema(User),
 *     )
 *   )
 * )
 * ```
 *
 * @since 0.2.0
 */
export const multipleWithSchema =
  <A, I>(
    schema: PureSchemaWithEncodedType<A, I>,
    concurrency?: Types.Concurrency
  ) =>
  (
    builder: PromiseLike<PostgrestResponse<I>>
  ): Effect.Effect<Array<A>, PostgrestError | Schema.SchemaError> =>
    pipe(
      Effect.promise(() => builder.then((r) => r)),
      Effect.flatMap(PgResponse.flatMapMultipleWithSchema(schema, concurrency))
    );

/**
 * Executes the builder and maps the response with schema decoding,
 * **silently filtering out** rows that fail to decode.
 *
 * Unlike {@link multipleWithSchema}, this does not fail on decode errors —
 * invalid rows are simply excluded from the result.
 *
 * @param schema - A pure `Schema` to decode each row.
 * @param concurrency - Optional concurrency setting for parallel decoding.
 *
 * @see {@link multipleWithSchema} to fail the `Effect` when any row fails to decode.
 *
 * @example
 * ```ts
 * Client.getClient().pipe(
 *   Effect.flatMap(client =>
 *     pipe(
 *       Postgrest.table("events")(client),
 *       Postgrest.select("id, payload"),
 *       Postgrest.filterMapMultipleWithSchema(EventSchema),
 *     )
 *   )
 * )
 * ```
 *
 * @since 0.2.0
 */
export const filterMapMultipleWithSchema =
  <A, I>(
    schema: PureSchemaWithEncodedType<A, I>,
    concurrency?: Types.Concurrency
  ) =>
  (
    builder: PromiseLike<PostgrestResponse<I>>
  ): Effect.Effect<Array<A>, PostgrestError> =>
    pipe(
      Effect.promise(() => builder.then((r) => r)),
      Effect.flatMap(
        PgResponse.filterMapMultipleWithSchema(schema, concurrency)
      )
    );

/**
 * Executes the builder and maps the response to `Effect<T, PostgrestError>`.
 *
 * Use this at the end of a pipeline where exactly **one** row is expected.
 * The builder should have been narrowed with {@link asSingle} beforehand.
 *
 * Returns a failed `Effect` with `PostgrestError` if the query returns zero
 * or more than one row (PostgREST returns a 406 error in this case).
 *
 * @returns A function that takes a builder and returns an `Effect` with the single decoded row.
 *
 * @example
 * ```ts
 * Client.getClient().pipe(
 *   Effect.flatMap(client =>
 *     pipe(
 *       Postgrest.table("users")(client),
 *       Postgrest.select("id, name, email"),
 *       Postgrest.eq("id", userId),
 *       Postgrest.asSingle(),
 *       Postgrest.single(),
 *     )
 *   )
 * )
 * ```
 *
 * @since 0.2.0
 */
export const single =
  () =>
  <Result>(
    builder: PromiseLike<PostgrestSingleResponse<Result>>
  ): Effect.Effect<Result, PostgrestError> =>
    pipe(
      Effect.promise(() => builder.then((r) => r)),
      Effect.flatMap(PgResponse.flatMapSingle())
    );

/**
 * Executes the builder and maps the single response with schema decoding to
 * `Effect<A, PostgrestError | SchemaError>`.
 *
 * The builder should have been narrowed with {@link asSingle} beforehand.
 *
 * @param schema - A pure `Schema` to decode the row.
 *
 * @example
 * ```ts
 * const User = Schema.Struct({
 *   id: Schema.Number,
 *   name: Schema.String,
 * })
 *
 * Client.getClient().pipe(
 *   Effect.flatMap(client =>
 *     pipe(
 *       Postgrest.table("users")(client),
 *       Postgrest.select("id, name"),
 *       Postgrest.eq("id", userId),
 *       Postgrest.asSingle(),
 *       Postgrest.singleWithSchema(User),
 *     )
 *   )
 * )
 * ```
 *
 * @since 0.2.0
 */
export const singleWithSchema =
  <A, I>(schema: PureSchemaWithEncodedType<A, I>) =>
  (
    builder: PromiseLike<PostgrestSingleResponse<I>>
  ): Effect.Effect<A, PostgrestError | Schema.SchemaError> =>
    pipe(
      Effect.promise(() => builder.then((r) => r)),
      Effect.flatMap(PgResponse.flatMapSingleWithSchema(schema))
    );

/**
 * Executes the builder and maps the response to `Effect<Option<T>, PostgrestError>`.
 *
 * Use this at the end of a pipeline where **zero or one** row is expected.
 * The builder should have been narrowed with {@link asMaybeSingle} beforehand.
 *
 * Returns `Option.some(data)` when a row is found, `Option.none()` when no row matches.
 *
 * @returns A function that takes a builder and returns an `Effect` with an `Option` of the decoded row.
 *
 * @example
 * ```ts
 * Client.getClient().pipe(
 *   Effect.flatMap(client =>
 *     pipe(
 *       Postgrest.table("users")(client),
 *       Postgrest.select("id, name, email"),
 *       Postgrest.eq("email", email),
 *       Postgrest.asMaybeSingle(),
 *       Postgrest.maybeSingle(),
 *     )
 *   )
 * )
 * ```
 *
 * @since 0.2.0
 */
export const maybeSingle =
  () =>
  <Result>(
    builder: PromiseLike<PostgrestMaybeSingleResponse<Result>>
  ): Effect.Effect<Option.Option<Result>, PostgrestError> =>
    pipe(
      Effect.promise(() => builder.then((r) => r)),
      Effect.flatMap(PgResponse.flatMapNullable())
    );

/**
 * Executes the builder and maps the nullable response with schema decoding to
 * `Effect<Option<A>, PostgrestError | SchemaError>`.
 *
 * The builder should have been narrowed with {@link asMaybeSingle} beforehand.
 *
 * @param schema - A pure `Schema` to decode the row (if present).
 *
 * @example
 * ```ts
 * const User = Schema.Struct({
 *   id: Schema.Number,
 *   name: Schema.String,
 * })
 *
 * Client.getClient().pipe(
 *   Effect.flatMap(client =>
 *     pipe(
 *       Postgrest.table("users")(client),
 *       Postgrest.select("id, name"),
 *       Postgrest.eq("email", email),
 *       Postgrest.asMaybeSingle(),
 *       Postgrest.maybeSingleWithSchema(User),
 *     )
 *   )
 * )
 * ```
 *
 * @since 0.2.0
 */
export const maybeSingleWithSchema =
  <A, I>(schema: PureSchemaWithEncodedType<A, I>) =>
  (
    builder: PromiseLike<PostgrestMaybeSingleResponse<I>>
  ): Effect.Effect<Option.Option<A>, PostgrestError | Schema.SchemaError> =>
    pipe(
      Effect.promise(() => builder.then((r) => r)),
      Effect.flatMap(PgResponse.flatMapNullableWithSchema(schema))
    );
