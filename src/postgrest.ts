/* eslint-disable @typescript-eslint/no-explicit-any */

import type {
  PostgrestSingleResponse,
  PostgrestMaybeSingleResponse,
  PostgrestResponse,
} from "@supabase/supabase-js";
import type {
  PostgrestQueryBuilder,
  PostgrestFilterBuilder,
  UnstableGetResult as GetResult,
} from "@supabase/postgrest-js";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Types from "effect/Types";
import { pipe } from "effect";
import { getClient } from "./client.js";
import { PostgrestError } from "./postgrest-error.js";
import * as PgResponse from "./pg-response.js";
import { PureSchemaWithEncodedType } from "./schema.js";

// Re-export so TypeScript registers `@supabase/postgrest-js` by its portable
// package name when emitting declaration files (prevents TS2742).
export type { PostgrestQueryBuilder } from "@supabase/postgrest-js";

// ---------------------------------------------------------------------------
// Helper types
// ---------------------------------------------------------------------------

/**
 * Structural constraint used by filters and transforms to require a method
 * named `K` without importing the Supabase builder type directly. Importing
 * `PostgrestFilterBuilder<any, ...>` causes TypeScript OOM via the recursive
 * select-string parser, so this loose shape is deliberate. Argument and
 * return types are intentionally `any` — the strong typing comes from the
 * outer signatures and the `as B` cast at each call site.
 */
type BuilderWith<K extends string> = {
  [P in K]: (...args: any[]) => any;
};

/**
 * Extract the row type `T` from a builder whose `PromiseLike` resolves to
 * `PostgrestResponse<T>` (i.e. `PostgrestSingleResponse<T[]>`).
 *
 * This is used by the execute functions to infer the row type from a properly-
 * typed builder produced by {@link from}.
 */
type InferRow<B> =
  B extends PromiseLike<PostgrestResponse<infer T>> ? T : unknown;

/**
 * Extracts builder type parameters and computes the select result type using
 * Supabase's GetResult. This enables type inference for pipe-able select().
 */
type ComputeSelectResult<QB, Q extends string> =
  // Extract from PostgrestQueryBuilder
  QB extends PostgrestQueryBuilder<
    infer ClientOptions,
    infer Schema,
    infer Relation,
    infer RelationName,
    infer Relationships
  >
    ? PostgrestFilterBuilder<
        ClientOptions,
        Schema,
        Relation extends { Row: infer R } ? R : never,
        GetResult<
          Schema,
          Relation extends { Row: infer R extends Record<string, unknown> }
            ? R
            : never,
          RelationName,
          Relationships,
          Q,
          ClientOptions
        >[],
        RelationName,
        Relationships,
        "GET"
      >
    : // Extract from PostgrestFilterBuilder (for chaining after mutations)
      QB extends PostgrestFilterBuilder<
          infer ClientOptions,
          infer Schema,
          infer Row,
          any,
          infer RelationName,
          infer Relationships,
          any
        >
      ? PostgrestFilterBuilder<
          ClientOptions,
          Schema,
          Row,
          GetResult<
            Schema,
            Row extends Record<string, unknown> ? Row : never,
            RelationName,
            Relationships,
            Q,
            ClientOptions
          >[],
          RelationName,
          Relationships,
          "GET"
        >
      : unknown;

// ---------------------------------------------------------------------------
// Builder entry point
// ---------------------------------------------------------------------------

/**
 * Resolves the public schema for a given Supabase `Database` type. Mirrors
 * the default schema resolution that supabase-js performs when the user
 * doesn't specify an explicit schema.
 */
type ResolvePublicSchema<DB> = DB extends { public: infer S } ? S : never;

/**
 * Resolves the relation entry (Tables[T] or Views[T]) for a given relation
 * name. Tables take precedence; falls back to Views; otherwise `never`.
 *
 * This is the workaround for a TypeScript overload-resolution quirk: when
 * `client.from(name)` is called inside a generic closure (`name: T extends
 * string`), the compiler picks one overload at body-analysis time, and the
 * "view" overload effectively gets dropped (Relation widens to `unknown`).
 * By computing the relation type ourselves and casting, we preserve full
 * type inference for both tables and views.
 */
type ResolveRelation<DB, T extends string> =
  ResolvePublicSchema<DB> extends { Tables: infer TBL }
    ? T extends keyof TBL
      ? TBL[T]
      : ResolvePublicSchema<DB> extends { Views: infer VW }
        ? T extends keyof VW
          ? VW[T]
          : never
        : never
    : never;

/**
 * Extracts `Relationships` from the resolved relation, defaulting to `unknown`
 * (matches supabase-js's default for `PostgrestQueryBuilder`).
 */
type ResolveRelationships<DB, T extends string> =
  ResolveRelation<DB, T> extends { Relationships: infer R } ? R : unknown;

/**
 * The resolved `PostgrestQueryBuilder` type for a given `Database` and
 * relation name.
 *
 * `Schema` is preserved (not widened to `any`) so that
 * `select()`'s string-literal column parser — `GetResult<Schema, Row,
 * RelationName, Relationships, Q, ClientOptions>` — can resolve embedded
 * resources (e.g. `select("id, posts(*)")`). `ClientOptions` is left as
 * `any` because no combinator depends on it.
 */
type ResolveQueryBuilder<DB, T extends string> = PostgrestQueryBuilder<
  any,
  ResolvePublicSchema<DB> extends infer S
    ? S extends {
        Tables: Record<string, unknown>;
        Views: Record<string, unknown>;
        Functions: Record<string, unknown>;
      }
      ? S
      : never
    : never,
  ResolveRelation<DB, T> extends { Row: Record<string, unknown> }
    ? ResolveRelation<DB, T>
    : { Row: Record<string, unknown>; Relationships: [] },
  T,
  ResolveRelationships<DB, T>
>;

/**
 * Creates a PostgREST query builder for the given table or view.
 *
 * This is the **recommended entry point** for all queries. It accesses the
 * {@link Client} service from the Effect context, calls `client.from(tableName)`,
 * and returns a typed query builder wrapped in an `Effect`.
 *
 * Works uniformly for tables and views: both updatable and non-updatable
 * views (entries under `Database["public"]["Views"]`) resolve to the correct
 * row type at the type level. For non-updatable views (no `Insert`/`Update`
 * fields), mutation combinators like {@link insert}/{@link update}/
 * {@link delete_} will fail at compile time, matching supabase-js.
 *
 * Chain with {@link select} for read queries, or {@link insert}, {@link update},
 * {@link upsert}, {@link delete_} for mutations on tables and updatable views.
 *
 * @typeParam DB - The generated Supabase database schema type.
 * @param tableName - The name of the table or view to query.
 *
 * @example
 * ```ts
 * // Read query (table)
 * pipe(
 *   Postgrest.from<Database>()("users"),
 *   Postgrest.select("id, name, email"),
 *   Postgrest.eq("active", true),
 *   Postgrest.order("name"),
 *   Postgrest.executeMultiple(),
 * )
 *
 * // Read query (view)
 * pipe(
 *   Postgrest.from<Database>()("user_post_counts"),
 *   Postgrest.select("user_id, post_count"),
 *   Postgrest.executeMultiple(),
 * )
 *
 * // Mutation (table or updatable view)
 * pipe(
 *   Postgrest.from<Database>()("users"),
 *   Postgrest.insert({ name: "Alice", email: "alice@example.com" }),
 *   Postgrest.select("id, name"),
 *   Postgrest.executeSingle(),
 * )
 * ```
 *
 * @since 0.3.0
 */
export const from =
  <DB>() =>
  <T extends string>(tableName: T) =>
    Effect.map(getClient<DB>(), (client) =>
      client.from(tableName as never)
    ) as unknown as Effect.Effect<
      ResolveQueryBuilder<DB, T>,
      never,
      import("./client.js").Client
    >;

/**
 * Alias for {@link from}. Creates a PostgREST query builder for the given table.
 *
 * @typeParam DB - The generated Supabase database schema type.
 * @param tableName - The name of the table or view.
 *
 * @deprecated Use {@link from} instead. `table` will be removed in a future version.
 *
 * @since 0.1.0
 */
export const table = from;

/**
 * Performs a PostgreSQL function (RPC) call.
 *
 * This is the entry point for calling PostgreSQL functions defined in your
 * database. The function name and arguments are type-checked against your
 * generated database types.
 *
 * The returned builder supports filters and transforms for functions that
 * return `SETOF` (multiple rows).
 *
 * @typeParam DB - The generated Supabase database schema type.
 * @param fn - The name of the PostgreSQL function to call.
 * @param args - The arguments to pass to the function. Defaults to `{}`.
 * @param options - Optional settings.
 * @param options.head - When `true`, performs a HEAD request (no response body, count only).
 * @param options.get - When `true`, uses GET instead of POST (for read-only functions).
 * @param options.count - Count algorithm: `"exact"`, `"planned"`, or `"estimated"`.
 *
 * @example
 * Call a function returning a single value:
 * ```ts
 * pipe(
 *   Postgrest.rpc<Database>()("get_user_stats", { user_id: 123 }),
 *   Postgrest.executeSingle(),
 * )
 * ```
 *
 * @example
 * Call a SETOF function with filters:
 * ```ts
 * pipe(
 *   Postgrest.rpc<Database>()("search_users", { query: "alice" }),
 *   Postgrest.order("name"),
 *   Postgrest.limit(10),
 *   Postgrest.executeMultiple(),
 * )
 * ```
 *
 * @since 0.3.0
 */
export const rpc =
  <DB>() =>
  <FnName extends string, Args extends Record<string, unknown> = never>(
    fn: FnName,
    args: Args = {} as Args,
    options: {
      head?: boolean;
      get?: boolean;
      count?: "exact" | "planned" | "estimated";
    } = {}
  ) =>
    Effect.map(getClient<DB>(), (client) => client.rpc(fn, args, options));

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
  <QB extends BuilderWith<"select">, E, R>(
    effect: Effect.Effect<QB, E, R>
  ): Effect.Effect<ComputeSelectResult<QB, Q>, E, R> =>
    Effect.map(
      effect,
      (qb) => qb.select(columns, options) as ComputeSelectResult<QB, Q>
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
  <QB extends BuilderWith<"delete">, E, R>(effect: Effect.Effect<QB, E, R>) =>
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
  <B extends BuilderWith<"eq">, E, R>(
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
  <B extends BuilderWith<"neq">, E, R>(
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
  <B extends BuilderWith<"gt">, E, R>(
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
  <B extends BuilderWith<"gte">, E, R>(
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
  <B extends BuilderWith<"lt">, E, R>(
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
  <B extends BuilderWith<"lte">, E, R>(
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
  <B extends BuilderWith<"like">, E, R>(
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
  <B extends BuilderWith<"ilike">, E, R>(
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
  <B extends BuilderWith<"is">, E, R>(
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
  <B extends BuilderWith<"in">, E, R>(
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
  <B extends BuilderWith<"contains">, E, R>(
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
  <B extends BuilderWith<"containedBy">, E, R>(
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
  <B extends BuilderWith<"overlaps">, E, R>(
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
  <B extends BuilderWith<"rangeGt">, E, R>(
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
  <B extends BuilderWith<"rangeGte">, E, R>(
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
  <B extends BuilderWith<"rangeLt">, E, R>(
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
  <B extends BuilderWith<"rangeLte">, E, R>(
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
  <B extends BuilderWith<"rangeAdjacent">, E, R>(
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
  <B extends BuilderWith<"textSearch">, E, R>(
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
  <B extends BuilderWith<"match">, E, R>(
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
  <B extends BuilderWith<"not">, E, R>(
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
  <B extends BuilderWith<"or">, E, R>(
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
  <B extends BuilderWith<"filter">, E, R>(
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
  <B extends BuilderWith<"order">, E, R>(
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
  <B extends BuilderWith<"limit">, E, R>(
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
  <B extends BuilderWith<"range">, E, R>(
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
  <B extends PromiseLike<PostgrestResponse<any>> & BuilderWith<"single">, E, R>(
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
    B extends PromiseLike<PostgrestResponse<any>> & BuilderWith<"maybeSingle">,
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
  <B extends BuilderWith<"csv">, E, R>(effect: Effect.Effect<B, E, R>) =>
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
      Effect.flatMap(PgResponse.flatMapMultipleWithSchema(schema, concurrency))
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
      Effect.flatMap(
        PgResponse.filterMapMultipleWithSchema(schema, concurrency)
      )
    );

/**
 * Executes a PostgREST query and returns `{ data, count }`, preserving the
 * `count` field from the response.
 *
 * `count` is `null` unless a count option was passed (e.g. `select("*", { count: "exact" })`).
 *
 * @example
 * ```ts
 * pipe(
 *   Postgrest.from<Database>()("users"),
 *   Postgrest.select("id, name", { count: "exact" }),
 *   Postgrest.eq("active", true),
 *   Postgrest.range(0, 49),
 *   Postgrest.executeMultipleWithCount(),
 * )
 * ```
 *
 * @since 0.4.0
 */
export const executeMultipleWithCount =
  () =>
  <T, E, R>(
    effect: Effect.Effect<PromiseLike<PostgrestResponse<T>>, E, R>
  ): Effect.Effect<
    { data: T[]; count: number | null },
    E | PostgrestError,
    R
  > =>
    pipe(
      effect,
      Effect.flatMap((builder) => Effect.promise(() => builder.then((r) => r))),
      Effect.flatMap((response) =>
        PgResponse.flatMapMultipleWithCount()(response as PostgrestResponse<T>)
      )
    );

/**
 * Executes a PostgREST query and returns `{ data, count }`, decoding each row
 * with an Effect Schema. Fails the `Effect` if any row fails to decode.
 *
 * @param schema - A pure `Schema` to decode each row.
 * @param concurrency - Optional concurrency setting for parallel decoding.
 *
 * @see {@link executeFilterMapMultipleWithCountAndSchema} to silently filter out rows that fail to decode.
 *
 * @since 0.4.0
 */
export const executeMultipleWithCountAndSchema =
  <A, I = A>(
    schema: PureSchemaWithEncodedType<A, I>,
    concurrency?: Types.Concurrency
  ) =>
  <E, R>(
    effect: Effect.Effect<PromiseLike<PostgrestResponse<any>>, E, R>
  ): Effect.Effect<
    { data: A[]; count: number | null },
    E | PostgrestError | Schema.SchemaError,
    R
  > =>
    pipe(
      effect,
      Effect.flatMap((builder) => Effect.promise(() => builder.then((r) => r))),
      Effect.flatMap(
        PgResponse.flatMapMultipleWithCountAndSchema(schema, concurrency)
      )
    );

/**
 * Executes a PostgREST query and returns `{ data, count }`, decoding each row
 * with an Effect Schema and silently filtering out rows that fail to decode.
 *
 * @param schema - A pure `Schema` to decode each row.
 * @param concurrency - Optional concurrency setting for parallel decoding.
 *
 * @see {@link executeMultipleWithCountAndSchema} to fail the `Effect` when any row fails to decode.
 *
 * @since 0.4.0
 */
export const executeFilterMapMultipleWithCountAndSchema =
  <A, I = A>(
    schema: PureSchemaWithEncodedType<A, I>,
    concurrency?: Types.Concurrency
  ) =>
  <E, R>(
    effect: Effect.Effect<PromiseLike<PostgrestResponse<any>>, E, R>
  ): Effect.Effect<
    { data: A[]; count: number | null },
    E | PostgrestError,
    R
  > =>
    pipe(
      effect,
      Effect.flatMap((builder) => Effect.promise(() => builder.then((r) => r))),
      Effect.flatMap(
        PgResponse.filterMapMultipleWithCountAndSchema(schema, concurrency)
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
  <B extends PromiseLike<PostgrestResponse<any>> & BuilderWith<"single">, E, R>(
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
      PromiseLike<PostgrestResponse<any>> & BuilderWith<"single">,
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
    B extends PromiseLike<PostgrestResponse<any>> & BuilderWith<"maybeSingle">,
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
      PromiseLike<PostgrestResponse<any>> & BuilderWith<"maybeSingle">,
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
