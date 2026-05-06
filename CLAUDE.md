# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm build          # Compile TypeScript to dist/
pnpm watch          # Watch mode compilation
pnpm clean          # Remove dist/
pnpm typecheck      # Type-check without emitting
pnpm lint           # ESLint src/
pnpm format         # Prettier format src/
pnpm format:check   # Check formatting
```

No test suite exists yet. Build output goes to `dist/`.

## Architecture

This is a TypeScript library (`supabase-effect`) that wraps `@supabase/supabase-js` with [Effect-ts](https://effect.website/) abstractions.

**Note:** This library only supports Effect v4 (currently beta). The `effect` dependency is pinned to `4.0.0-beta.60`.

## Breaking Changes in v0.2.0

### Renamed Execution Functions

All convenience combinators have been renamed to use the `execute*` prefix for clarity:

| Old Name | New Name |
|----------|----------|
| `multiple()` | `executeMultiple()` |
| `single()` | `executeSingle()` |
| `maybeSingle()` | `executeMaybeSingle()` |
| `multipleWithSchema()` | `executeMultipleWithSchema()` |
| `singleWithSchema()` | `executeSingleWithSchema()` |
| `maybeSingleWithSchema()` | `executeMaybeSingleWithSchema()` |
| `filterMapMultipleWithSchema()` | `executeFilterMapMultipleWithSchema()` |

**Backward compatibility**: Old names are still available as deprecated aliases.

### No More `asSingle()` / `asMaybeSingle()` Required

The new `executeSingle()` and `executeMaybeSingle()` functions automatically apply the type narrowing transform:

```ts
// Old:
pipe(
  Postgrest.select("id, name"),
  Postgrest.eq("id", 1),
  Postgrest.asSingle(),  // ← Manual transform
  Postgrest.single()     // ← Execute
)

// New:
pipe(
  Postgrest.select("id, name"),
  Postgrest.eq("id", 1),
  Postgrest.executeSingle()  // ← Auto-applies .single()
)
```

### Fixed: Schema Validation + Filters

Schema validation functions now accept builders with filters applied:

```ts
// This now works!
pipe(
  Postgrest.table("users")(client),
  Postgrest.select("id, name, email"),
  Postgrest.eq("active", true),  // ← Filter works with schema
  Postgrest.executeMultipleWithSchema(UserSchema)
)
```

### Export Paths

| Path | Description |
|---|---|
| `supabase-effect` | Re-exports all modules as namespaces: `Auth`, `AuthError`, `Client`, `Postgrest`, `PgResponse`, `PostgrestError`, `Storage`, `StorageError` |
| `supabase-effect/client` | `Client` service, `withClient`, and `getClient` |
| `supabase-effect/auth` | `Auth` service |
| `supabase-effect/auth-error` | `AuthError` class |
| `supabase-effect/postgrest` | PostgREST query builder, filters, transforms, execute, and convenience combinators |
| `supabase-effect/postgrest-response` | PostgREST response mappers (low-level) |
| `supabase-effect/postgrest-error` | `PostgrestError` class |
| `supabase-effect/storage` | `Storage` service |
| `supabase-effect/storage-error` | `StorageError` class |

### Client layer (`src/client.ts`)

`Client` is an Effect `Context.Service` that wraps `SupabaseClient`. It is provided via `Layer`:
- `Client.browser(url, key)` — creates a browser client layer
- `Client.ssr(url, key, { cookies })` — creates an SSR client layer using `@supabase/ssr`

`withClient<D>()` is the primary usage pattern — it accesses the `Client` service and runs a `SupabaseClient`-dependent async function as an `Effect`.

`getClient<D>()` returns the raw `SupabaseClient` as an `Effect` for cases where direct access is needed (e.g. inside `Auth` and `Storage`).

### Auth service (`src/auth.ts`)

`Auth` is an Effect `Context.Service` that wraps `SupabaseClient.auth`. It requires `Client` in its context and is provided via `Auth.layer`.

All methods mirror the `@supabase/supabase-js` auth API but return `Effect`s instead of Promises:
- Nullable results are wrapped in `Option`
- Errors are wrapped in `AuthError`
- Methods cover admin operations, MFA, OAuth, sign-in/sign-out, session management, and more

### Auth error (`src/auth-error.ts`)

`AuthError` is a tagged `Data.TaggedError("supabase-effect/AuthError")` wrapping Supabase's native `AuthError`. It also exposes a namespace with helpers:

| Helper | Description |
|---|---|
| `AuthError.is(e)` | Type guard |
| `AuthError.mapCode(code, f)` | Maps a specific error code to a different error (like `Effect.mapError`) |
| `AuthError.catchCode(code, f)` | Catches a specific error code with an Effect (like `Effect.catchTag`) |

### Storage service (`src/storage.ts`)

`Storage` is an Effect `Context.Service` that wraps `SupabaseClient.storage`. It requires `Client` in its context and is provided via `Storage.layer`.

All methods take `bucket: string` as their first argument, followed by the original SDK parameters. They return `Effect`s instead of Promises:
- Nullable results are wrapped in `Option`
- Errors are wrapped in `StorageError`
- Methods cover file operations (upload, download, copy, move, delete), signed URL generation, and bucket management

### Storage error (`src/storage-error.ts`)

`StorageError` is a tagged `Data.TaggedError("supabase-effect/StorageError")` wrapping Supabase's native storage error. The underlying `SupabaseStorageError` type is not publicly exported by `@supabase/supabase-js`, so it is inferred internally via `NonNullable<Awaited<...>["error"]>`.

### PostgREST query builder (`src/postgrest.ts`)

Pure pipe-able utilities for building PostgREST queries, with an explicit effectful execution boundary.

**Design**: Build phase is pure functions (no Effect wrapping). Execution is explicit via `execute` or convenience combinators. This preserves Supabase's type-level select query parsing.

**Builder entry points:**
| Function | Description |
|---|---|
| `from<DB>()(tableName)` | Returns `Effect` wrapping `PostgrestQueryBuilder` for table queries |
| `rpc<DB>()(fn, args?, options?)` | Returns `Effect` wrapping `PostgrestFilterBuilder` for RPC calls |
| `table<DB>()(tableName)` | Deprecated alias for `from()` |

**Query starters (pure):**
| Function | Description |
|---|---|
| `select<Q>(columns?, options?)` | Captures string literal `Q` for type-level parsing |
| `insert(values, options?)` | Maps to `.insert()` |
| `update(values, options?)` | Maps to `.update()` |
| `upsert(values, options?)` | Maps to `.upsert()` |
| `delete_(options?)` | Maps to `.delete()` (`delete` is reserved) |

**Filters (pure, return same builder type):**
`eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `like`, `ilike`, `is`, `in_`, `contains`, `containedBy`, `overlaps`, `rangeGt`, `rangeGte`, `rangeLt`, `rangeLte`, `rangeAdjacent`, `textSearch`, `match`, `not`, `or`, `filter`

**Transforms (pure):**
| Function | Description |
|---|---|
| `order`, `limit`, `range` | Preserves builder type |
| `asSingle()` | Narrows to single row (pure, no execution) |
| `asMaybeSingle()` | Narrows to nullable single row (pure) |
| `asCsv()` | Converts to CSV format (pure) |

**Execution:**
| Function | Description |
|---|---|
| `execute` | `PromiseLike<Response>` → `Effect<Response>` |

**Convenience combinators (execute + response mapping):**
| Function | Description |
|---|---|
| `executeMultiple()` | → `Effect<T[], PostgrestError>` |
| `executeMultipleWithSchema(s)` | → `Effect<A[], PostgrestError \| SchemaError>` |
| `executeFilterMapMultipleWithSchema(s)` | → `Effect<A[], PostgrestError>` (filters failures) |
| `executeMultipleWithCount()` | → `Effect<{ data: T[]; count: number \| null }, PostgrestError>` |
| `executeMultipleWithCountAndSchema(s)` | → `Effect<{ data: A[]; count: number \| null }, PostgrestError \| SchemaError>` |
| `executeFilterMapMultipleWithCountAndSchema(s)` | → `Effect<{ data: A[]; count: number \| null }, PostgrestError>` (filters failures) |
| `executeSingle()` | → `Effect<T, PostgrestError>` (auto-applies `.single()`) |
| `executeSingleWithSchema(s)` | → `Effect<A, PostgrestError \| SchemaError>` (auto-applies `.single()`) |
| `executeMaybeSingle()` | → `Effect<Option<T>, PostgrestError>` (auto-applies `.maybeSingle()`) |
| `executeMaybeSingleWithSchema(s)` | → `Effect<Option<A>, PostgrestError \| SchemaError>` (auto-applies `.maybeSingle()`) |

The `*WithCount` variants preserve Supabase's `count` field. `count` is `null` unless the query was issued with a count option (e.g. `select("*", { count: "exact" })`).

Example usage:
```ts
// Table query
pipe(
  Postgrest.from<Database>()("users"),
  Postgrest.select("id, name, email"),
  Postgrest.eq("active", true),
  Postgrest.order("name"),
  Postgrest.limit(10),
  Postgrest.executeMultiple(),
)

// RPC call (SETOF function)
pipe(
  Postgrest.rpc<Database>()("search_users", { query: "alice" }),
  Postgrest.order("relevance", { ascending: false }),
  Postgrest.limit(10),
  Postgrest.executeMultiple(),
)

// RPC call (scalar function)
pipe(
  Postgrest.rpc<Database>()("get_user_stats", { user_id: 123 }),
  Postgrest.execute,
)
```

**Type strategy**: Filter and transform constraints use a structural alias `BuilderWith<K extends string> = { [P in K]: (...args: any[]) => any }` rather than importing `PostgrestFilterBuilder` / `PostgrestQueryBuilder` directly. Three reasons:

1. Filters (`eq`, `order`, `single`, etc.) live on `PostgrestFilterBuilder` (and `PostgrestTransformBuilder`), not on `PostgrestQueryBuilder` — so the latter can't be the constraint.
2. `PostgrestFilterBuilder<any × 7>` triggers TypeScript OOM via `GetResult`, the recursive select-string parser baked into the `Result` generic. The constraint-check phase walks that parser at every call site.
3. `select` legitimately accepts both `PostgrestQueryBuilder` (initial) and `PostgrestFilterBuilder` (after a mutation chain like `update().select()`) — `ComputeSelectResult` has two `extends` branches for this reason. A nominal union would pay the OOM tax twice; the structural alias covers both for free.

Type precision is preserved via `as B` at each call site (carries the user's specific builder type) and via `ComputeSelectResult` for `select`. The structural constraint only governs *acceptance*, not the *output* type.

### PostgREST response mappers (`src/pg-response.ts`)

Pipe-able functions that convert Supabase's `PostgrestResponse` types into `Effect`s:

| Function | Input | Output |
|---|---|---|
| `flatMapMultiple()` | `PostgrestResponse<T>` | `Effect<T[], PostgrestError>` |
| `flatMapMultipleWithSchema(s)` | `PostgrestResponse<I>` | `Effect<A[], PostgrestError \| SchemaError>` |
| `filterMapMultipleWithSchema(s)` | `PostgrestResponse<I>` | `Effect<A[], PostgrestError>` (filters decode failures) |
| `flatMapMultipleWithCount()` | `PostgrestResponse<T>` | `Effect<{ data: T[]; count: number \| null }, PostgrestError>` |
| `flatMapMultipleWithCountAndSchema(s)` | `PostgrestResponse<I>` | `Effect<{ data: A[]; count: number \| null }, PostgrestError \| SchemaError>` |
| `filterMapMultipleWithCountAndSchema(s)` | `PostgrestResponse<I>` | `Effect<{ data: A[]; count: number \| null }, PostgrestError>` (filters decode failures) |
| `flatMapSingle()` | `PostgrestSingleResponse<T>` | `Effect<T, PostgrestError>` |
| `flatMapSingleWithSchema(s)` | `PostgrestSingleResponse<I>` | `Effect<A, PostgrestError \| SchemaError>` |
| `flatMapNullable()` | `PostgrestMaybeSingleResponse<T>` | `Effect<Option<T>, PostgrestError>` |
| `flatMapNullableWithSchema(s)` | `PostgrestMaybeSingleResponse<I>` | `Effect<Option<A>, PostgrestError \| SchemaError>` |

### PostgREST error (`src/postgrest-error.ts`)

`PostgrestError` is a tagged `Data.TaggedError("supabase-effect/PostgrestError")` wrapping Supabase's native `PostgrestError`. It also exposes a namespace with helpers:

| Helper | Description |
|---|---|
| `PostgrestError.is(e)` | Type guard |
| `PostgrestError.mapCode(code, f)` | Maps a specific error code to a different error (like `Effect.mapError`) |
| `PostgrestError.catchCode(code, f)` | Catches a specific error code with an Effect (like `Effect.catchTag`) |

### Schema utilities (`src/schema.ts`)

`PureSchema<A>` and `PureSchemaWithEncodedType<A, I>` are internal types constraining schemas to those requiring no decoding services. `decodePure` and `decodePureResult` are internal helpers used by the PostgREST mappers.

### Effect utilities (`src/effect-util.ts`)

Internal utilities that fill gaps in the current Effect version:

- `transpose` — converts `Option<Effect<A, E, R>>` to `Effect<Option<A>, E, R>`. Used internally by `flatMapNullableResponseWithSchema`.

## Conventions

- Effect modules are imported via named namespace imports: `import * as Effect from "effect/Effect"` (not `import { Effect } from "effect"`)
- `@effect/language-service` plugin is active — it applies Effect-specific transformations
- `noUnusedLocals: true` is enforced; `noUnusedParameters` is not
- Package manager: pnpm
- Multiple Supabase packages are hoisted via `.npmrc` for TypeScript type resolution:
  - `@supabase/storage-js` — required for `Storage` service
  - `@supabase/supabase-js` — required for core types
  - `@supabase/postgrest-js` — required for `PostgrestQueryBuilder` type

## Project Status

### Completed
- **Client**: Browser and SSR contexts fully supported
- **Auth**: 55+ methods wrapped with full coverage
- **Storage**: All file/bucket operations wrapped (18 methods)
- **PostgREST Response Mappers**: 10 response mapping functions
- **PostgREST Query Builder**: Pure builder functions, 24 filters, transforms, `execute`, and 10 convenience combinators
- **PostgREST RPC**: `rpc()` function for calling PostgreSQL functions with full type inference

### Planned (Not Started)
- **Edge Functions**: Supabase Edge Functions invocation support
- **Realtime**: Real-time subscription support
- **Type-safe Error Codes**: For `AuthError` and `PostgrestError`

## Known Issues

1. **`transpose` workaround** in `effect-util.ts`: Fills a gap in Effect v4; should be replaced when Effect adds built-in support.
2. **`SupabaseStorageError` type inference**: Uses return-type inference since the type isn't exported from `@supabase/supabase-js`.
3. **Error codes are untyped**: `mapCode` and `catchCode` accept `string` instead of discriminated union types.
