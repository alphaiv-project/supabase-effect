/**
 * Simple Type Inference Test
 *
 * This file demonstrates that Supabase's type-level query parser correctly
 * infers types through the Effect wrapper.
 */

import { pipe } from "effect";
import * as Effect from "effect/Effect";
import type { Database } from "./test-database.types";
import * as Client from "../src/client";
import * as Postgrest from "../src/postgrest";

// Create a client for testing
const clientLayer = Client.Client.browser(
  "https://example.supabase.co",
  "fake-anon-key"
);

// ---------------------------------------------------------------------------
// Test 1: Basic select with specific columns - type should be inferred
// ---------------------------------------------------------------------------

const test1 = Client.getClient<Database>().pipe(
  Effect.flatMap((client) =>
    pipe(
      Postgrest.table("users")(client),
      Postgrest.select("id, name, email"),
      Postgrest.executeMultiple()
    )
  )
);

// The inferred result type has columns: id, name, email

// ---------------------------------------------------------------------------
// Test 2: Select all columns
// ---------------------------------------------------------------------------

const test2 = Client.getClient<Database>().pipe(
  Effect.flatMap((client) =>
    pipe(
      Postgrest.table("users")(client),
      Postgrest.select("*"),
      Postgrest.eq("active", true),
      Postgrest.order("created_at", { ascending: false }),
      Postgrest.limit(10),
      Postgrest.executeMultiple()
    )
  )
);

// The inferred result type includes all table columns

// ---------------------------------------------------------------------------
// Test 3: Single row query
// ---------------------------------------------------------------------------

const test3 = (userId: number) =>
  Client.getClient<Database>().pipe(
    Effect.flatMap((client) =>
      pipe(
        Postgrest.table("users")(client),
        Postgrest.select("id, name, email, role"),
        Postgrest.eq("id", userId),
        Postgrest.executeSingle() // No asSingle() needed!
      )
    )
  );

// Returns a single object, not an array

// ---------------------------------------------------------------------------
// Test 4: Nullable single row query
// ---------------------------------------------------------------------------

const test4 = (email: string) =>
  Client.getClient<Database>().pipe(
    Effect.flatMap((client) =>
      pipe(
        Postgrest.table("users")(client),
        Postgrest.select("id, name, email"),
        Postgrest.eq("email", email),
        Postgrest.executeMaybeSingle() // No asMaybeSingle() needed!
      )
    )
  );

// Returns Option<T>

// ---------------------------------------------------------------------------
// Test 5: Insert and return
// ---------------------------------------------------------------------------

const test5 = (newUser: { name: string; email: string }) =>
  Client.getClient<Database>().pipe(
    Effect.flatMap((client) =>
      pipe(
        Postgrest.table("users")(client),
        Postgrest.insert(newUser),
        Postgrest.select("id, name, email, created_at"),
        Postgrest.executeSingle() // No asSingle() needed!
      )
    )
  );

// ---------------------------------------------------------------------------
// Test 6: Update and return
// ---------------------------------------------------------------------------

const test6 = (userId: number, newName: string) =>
  Client.getClient<Database>().pipe(
    Effect.flatMap((client) =>
      pipe(
        Postgrest.table("users")(client),
        Postgrest.update({ name: newName }),
        Postgrest.eq("id", userId),
        Postgrest.select("id, name, updated_at"),
        Postgrest.executeSingle() // No asSingle() needed!
      )
    )
  );

// Returns updated row with selected columns

// ---------------------------------------------------------------------------
// Test 7: Complex filters
// ---------------------------------------------------------------------------

const test7 = (minAge: number, roles: string[]) =>
  Client.getClient<Database>().pipe(
    Effect.flatMap((client) =>
      pipe(
        Postgrest.table("users")(client),
        Postgrest.select("id, name, age, role"),
        Postgrest.gte("age", minAge),
        Postgrest.in_("role", roles),
        Postgrest.is("deleted_at", null),
        Postgrest.order("age", { ascending: false }),
        Postgrest.executeMultiple()
      )
    )
  );

// ---------------------------------------------------------------------------
// Main program
// ---------------------------------------------------------------------------

const program = Effect.gen(function* () {
  const users = yield* test1;
  console.log("Users:", users);
  return users;
});

const runnable = program.pipe(Effect.provide(clientLayer));

// Export for testing
export { test1, test2, test3, test4, test5, test6, test7, program, runnable };
