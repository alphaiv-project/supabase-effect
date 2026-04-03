# Test Suite

This folder contains type inference tests for the `supabase-effect` PostgREST query builder.

## Files

- **`test-database.types.ts`** - Sample database schema simulating Supabase's generated types
- **`simple-type-test.ts`** - Type inference tests covering all query patterns
- **`tsconfig.json`** - TypeScript configuration for tests

## Running Tests

```bash
# Type check all files including tests
pnpm typecheck:all

# Type check only test files
pnpm typecheck:test

# Type check only src files
pnpm typecheck
```

## What's Being Tested

✅ Column selection type inference (`select("id, name")` infers `{ id: number; name: string }`)
✅ Multiple/single/nullable response types
✅ Schema validation with Effect Schema
✅ Insert/update type safety
✅ Filter type safety
✅ Error type unions

## Usage

Open `simple-type-test.ts` in your IDE and hover over variables to see the inferred types.

### Example

```typescript
const users = Client.getClient<Database>().pipe(
  Effect.flatMap((client) =>
    pipe(
      Postgrest.table("users")(client),
      Postgrest.select("id, name, email"),  // ← Type inferred here
      Postgrest.eq("active", true),
      Postgrest.multiple()
    )
  )
);
// users: Effect<Array<{ id: number; name: string; email: string }>, PostgrestError, Client>
```

The Supabase type-level query parser is fully preserved through the Effect wrapper!
