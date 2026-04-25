# supabase-effect

An [Effect-ts](https://effect.website/) wrapper for [Supabase](https://supabase.com/) that provides type-safe, composable database operations.

## Important: Effect v4 Beta Dependency

**This library requires `effect@4.0.0-beta.29`, which is currently experimental.**

- Effect v4 is in beta and APIs may change
- Production use: Evaluate stability requirements for your use case

We'll update to stable Effect v4 once released.

---

## Installation

```bash
pnpm add supabase-effect effect@4.0.0-beta.29
```

## Quick Start

```typescript
import { pipe } from "effect";
import * as Effect from "effect/Effect";
import * as Postgrest from "supabase-effect/postgrest";
import * as Client from "supabase-effect/client";
import type { Database } from "./database.types"; // Your generated types

// Build a type-safe query with full column inference
const getActiveUsers = pipe(
  Postgrest.from<Database>()("users"),
  Postgrest.select("id, name, email"),
  Postgrest.eq("active", true),
  Postgrest.order("name"),
  Postgrest.limit(10),
  Postgrest.executeMultiple()
);
// Result type: Effect<Array<{ id: number; name: string; email: string }>, PostgrestError, Client>

// Provide the client layer
const program = getActiveUsers.pipe(
  Effect.provide(Client.browser("https://your-project.supabase.co", "your-anon-key"))
);

// Run the effect
Effect.runPromise(program).then(console.log);
```

## Features

### PostgREST Query Builder

Pipe-able, type-safe query building with full column inference:

```typescript
// SELECT with column inference
pipe(
  Postgrest.from<Database>()("users"),
  Postgrest.select("id, name, email"),  // Type-safe column selection
  Postgrest.eq("active", true),
  Postgrest.executeMultiple()
)
// => Effect<Array<{ id: number; name: string; email: string }>, PostgrestError, Client>

// INSERT with RETURNING
pipe(
  Postgrest.from<Database>()("users"),
  Postgrest.insert({ name: "Alice", email: "alice@example.com" }),
  Postgrest.select("id, name, created_at"),
  Postgrest.executeSingle()
)
// => Effect<{ id: number; name: string; created_at: string }, PostgrestError, Client>

// UPDATE with filters
pipe(
  Postgrest.from<Database>()("users"),
  Postgrest.update({ name: "Bob" }),
  Postgrest.eq("id", 123),
  Postgrest.select("id, name, updated_at"),
  Postgrest.executeSingle()
)

// Schema validation
pipe(
  Postgrest.from<Database>()("users"),
  Postgrest.select("id, name, email"),
  Postgrest.executeMultipleWithSchema(UserSchema)
)
// => Effect<Array<{ readonly id: number; readonly name: string; readonly email: string }>, PostgrestError | SchemaError, Client>

// RPC: Call PostgreSQL functions (SETOF)
pipe(
  Postgrest.rpc<Database>()("search_users", { query: "alice" }),
  Postgrest.order("relevance", { ascending: false }),
  Postgrest.limit(10),
  Postgrest.executeMultiple()
)

// RPC: Scalar function (use raw execute)
pipe(
  Postgrest.rpc<Database>()("get_user_stats", { user_id: 123 }),
  Postgrest.execute
)
```

### Authentication

Full Auth API coverage with Effect-wrapped methods:

```typescript
import * as Auth from "supabase-effect/auth";

// Sign in
const signIn = Auth.signInWithPassword({
  email: "user@example.com",
  password: "password",
});

// Get current user
const user = Auth.getUser();

// Sign out
const signOut = Auth.signOut();

// All methods return Effect with proper error typing
// Nullable results wrapped in Option
```

### Storage

Complete Storage API with bucket operations:

```typescript
import * as Storage from "supabase-effect/storage";

// Upload file
const upload = Storage.upload("avatars", "user-123/avatar.png", file);

// Download file
const download = Storage.download("avatars", "user-123/avatar.png");

// Create signed URL
const signedUrl = Storage.createSignedUrl("avatars", "user-123/avatar.png", 3600);

// List files
const files = Storage.list("avatars", "user-123/");
```

### Client Layers

Browser and SSR contexts supported:

```typescript
import * as Client from "supabase-effect/client";

// Browser client
const browserLayer = Client.browser(SUPABASE_URL, SUPABASE_ANON_KEY);

// SSR client (Next.js, SvelteKit, etc.)
const ssrLayer = Client.ssr(SUPABASE_URL, SUPABASE_KEY, {
  cookies: {
    getAll: () => cookieStore.getAll(),
    setAll: (cookies) => cookies.forEach(c => cookieStore.set(c)),
  },
});

// Use with Effect.provide
myQuery.pipe(Effect.provide(browserLayer));
```

## Export Paths

| Path | Description |
|------|-------------|
| `supabase-effect` | Re-exports all modules as namespaces |
| `supabase-effect/client` | `Client` service, `withClient`, `getClient` |
| `supabase-effect/auth` | `Auth` service (55+ methods) |
| `supabase-effect/auth-error` | `AuthError` class with helpers |
| `supabase-effect/postgrest` | Query builder, filters, transforms, execute combinators |
| `supabase-effect/postgrest-response` | Low-level response mappers |
| `supabase-effect/postgrest-error` | `PostgrestError` class with helpers |
| `supabase-effect/storage` | `Storage` service (18 methods) |
| `supabase-effect/storage-error` | `StorageError` class |

## API Reference

### PostgREST

**Entry Points:**
- `from<DB>()(tableName)` - Start a query on a table
- `rpc<DB>()(fn, args?, options?)` - Call a PostgreSQL function

**Query Starters:**
- `select(columns, options?)` - SELECT with column inference
- `insert(values, options?)` - INSERT
- `update(values, options?)` - UPDATE
- `upsert(values, options?)` - UPSERT
- `delete_(options?)` - DELETE

**Filters:**
`eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `like`, `ilike`, `is`, `in_`, `contains`, `containedBy`, `overlaps`, `rangeGt`, `rangeGte`, `rangeLt`, `rangeLte`, `rangeAdjacent`, `textSearch`, `match`, `not`, `or`, `filter`

**Transforms:**
- `order(column, options?)` - ORDER BY
- `limit(count)` - LIMIT
- `range(from, to)` - Pagination
- `asSingle()` - Expect single row
- `asMaybeSingle()` - Expect 0 or 1 row
- `asCsv()` - CSV format

**Execute Combinators:**
| Function | Returns |
|----------|---------|
| `executeMultiple()` | `Effect<T[], PostgrestError>` |
| `executeSingle()` | `Effect<T, PostgrestError>` |
| `executeMaybeSingle()` | `Effect<Option<T>, PostgrestError>` |
| `executeMultipleWithSchema(s)` | `Effect<A[], PostgrestError \| SchemaError>` |
| `executeSingleWithSchema(s)` | `Effect<A, PostgrestError \| SchemaError>` |
| `executeMaybeSingleWithSchema(s)` | `Effect<Option<A>, PostgrestError \| SchemaError>` |
| `executeFilterMapMultipleWithSchema(s)` | `Effect<A[], PostgrestError>` (filters decode failures) |
| `executeMultipleWithCount()` | `Effect<{ data: T[]; count: number \| null }, PostgrestError>` |
| `executeMultipleWithCountAndSchema(s)` | `Effect<{ data: A[]; count: number \| null }, PostgrestError \| SchemaError>` |
| `executeFilterMapMultipleWithCountAndSchema(s)` | `Effect<{ data: A[]; count: number \| null }, PostgrestError>` |

The `*WithCount` variants preserve Supabase's `count` field. `count` is `null` unless the query was issued with a count option (e.g. `select("*", { count: "exact" })`).

### Error Handling

All error types provide helpers for code-specific handling:

```typescript
import { PostgrestError } from "supabase-effect/postgrest-error";
import { AuthError } from "supabase-effect/auth-error";

// Map specific error codes
myQuery.pipe(
  PostgrestError.mapCode("PGRST116", () => new NotFoundError())
);

// Catch specific error codes
myQuery.pipe(
  AuthError.catchCode("invalid_credentials", () =>
    Effect.succeed(defaultUser)
  )
);
```

---

## Roadmap

### Completed
- [x] Client wrapper (browser + SSR)
- [x] Authentication (55+ methods)
- [x] Storage (18 methods)
- [x] PostgREST query builder with full type inference
- [x] PostgREST RPC (PostgreSQL function calls)
- [x] Schema validation integration
- [x] Type-safe error codes for Auth and PostgREST

### Planned
- [ ] Edge Functions invocation
- [ ] Realtime subscriptions
