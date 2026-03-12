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

This is a TypeScript library (`supabase-effect`) that wraps `@supabase/supabase-js` with [Effect-ts](https://effect.website/) abstractions. It has three export paths:

- `supabase-effect` — re-exports everything as `Supabase.*`
- `supabase-effect/client` — `Client` service and `withClient`
- `supabase-effect/postgrest` — PostgREST response mappers and `PostgrestError`

### Client layer (`src/client.ts`)

`Client` is an Effect `ServiceMap.Service` that wraps `SupabaseClient`. It is provided via `Layer`:
- `Client.browser(url, key)` — creates a browser client layer
- `Client.ssr(url, key, { cookies })` — creates an SSR client layer using `@supabase/ssr`

`withClient<D>()` is the primary usage pattern — it accesses the `Client` service and runs a `SupabaseClient`-dependent async function as an `Effect`.

### PostgREST response mappers (`src/postgrest/util.ts`)

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

### Schema utilities (`src/schema.ts`)

`PureSchema<A>` and `PureSchemaWithEncodedType<A, I>` are internal types constraining schemas to those requiring no decoding services. `decodePure` and `decodePureResult` are internal helpers used by the PostgREST mappers.

### Error (`src/postgrest/error.ts`)

`PostgrestError` is a tagged `Data.TaggedError("supabase-effect/PostgrestError")` wrapping Supabase's native `PostgrestError`.

## Conventions

- Effect modules are imported via named namespace imports: `import * as Effect from "effect/Effect"` (not `import { Effect } from "effect"`)
- `@effect/language-service` plugin is active — it applies Effect-specific transformations
- `noUnusedLocals: true` is enforced; `noUnusedParameters` is not
- Package manager: pnpm
