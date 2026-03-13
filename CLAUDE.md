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

This is a TypeScript library (`supabase-effect`) that wraps `@supabase/supabase-js` with [Effect-ts](https://effect.website/) abstractions. It has the following export paths:

- `supabase-effect` — re-exports everything as namespaces: `Auth`, `AuthError`, `Client`, `Postgrest`, `PostgrestError`, `Storage`, `StorageError`
- `supabase-effect/client` — `Client` service, `withClient`, and `getClient`
- `supabase-effect/auth` — `Auth` service
- `supabase-effect/auth-error` — `AuthError` class
- `supabase-effect/postgrest` — PostgREST response mappers
- `supabase-effect/postgrest-error` — `PostgrestError` class

> Note: `Storage` and `StorageError` are only accessible via the root `supabase-effect` export.

### Client layer (`src/client.ts`)

`Client` is an Effect `ServiceMap.Service` that wraps `SupabaseClient`. It is provided via `Layer`:
- `Client.browser(url, key)` — creates a browser client layer
- `Client.ssr(url, key, { cookies })` — creates an SSR client layer using `@supabase/ssr`

`withClient<D>()` is the primary usage pattern — it accesses the `Client` service and runs a `SupabaseClient`-dependent async function as an `Effect`.

`getClient<D>()` returns the raw `SupabaseClient` as an `Effect` for cases where direct access is needed (e.g. inside `Auth` and `Storage`).

### Auth service (`src/auth.ts`)

`Auth` is an Effect `ServiceMap.Service` that wraps `SupabaseClient.auth`. It requires `Client` in its context and is provided via `Auth.layer`.

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

`Storage` is an Effect `ServiceMap.Service` that wraps `SupabaseClient.storage`. It requires `Client` in its context and is provided via `Storage.layer`.

All methods take `bucket: string` as their first argument, followed by the original SDK parameters. They return `Effect`s instead of Promises:
- Nullable results are wrapped in `Option`
- Errors are wrapped in `StorageError`
- Methods cover file operations (upload, download, copy, move, delete), signed URL generation, and bucket management

### Storage error (`src/storage-error.ts`)

`StorageError` is a tagged `Data.TaggedError("supabase-effect/StorageError")` wrapping Supabase's native storage error. The underlying `SupabaseStorageError` type is not publicly exported by `@supabase/supabase-js`, so it is inferred internally via `NonNullable<Awaited<...>["error"]>`.

### PostgREST response mappers (`src/postgrest.ts`)

These are `pipe`-able functions that convert Supabase's `PostgrestResponse` types into `Effect`s:

| Function | Input | Output |
|---|---|---|
| `flatMapMultipleResponse()` | `PostgrestResponse<T>` | `Effect<T[], PostgrestError>` |
| `flatMapMultipleResponseWithSchema(s)` | `PostgrestResponse<I>` | `Effect<A[], PostgrestError \| SchemaError>` |
| `filterMapMultipleResponseWithSchema(s)` | `PostgrestResponse<I>` | `Effect<A[], PostgrestError>` (filters decode failures) |
| `flatMapSingleResponse()` | `PostgrestSingleResponse<T>` | `Effect<T, PostgrestError>` |
| `flatMapSingleResponseWithSchema(s)` | `PostgrestSingleResponse<I>` | `Effect<A, PostgrestError \| SchemaError>` |
| `flatMapNullableResponse()` | `PostgrestMaybeSingleResponse<T>` | `Effect<Option<T>, PostgrestError>` |
| `flatMapNullableResponseWithSchema(s)` | `PostgrestMaybeSingleResponse<I>` | `Effect<Option<A>, PostgrestError \| SchemaError>` |

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
- `@supabase/storage-js` is hoisted via `.npmrc` (`public-hoist-pattern[]=@supabase/storage-js`) so TypeScript can resolve its types by package name — required to avoid `TS2742` on the `Storage` service class