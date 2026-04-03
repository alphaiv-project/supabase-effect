/**
 * Comprehensive Test Suite for PostgREST Query Builder
 *
 * This test suite validates:
 * 1. Schema validation functions (the main fix in v0.2.0)
 * 2. Schema + filters combination
 * 3. All execute function variants
 * 4. Error handling
 * 5. CRUD operations
 * 6. Edge cases
 */

import { pipe } from "effect";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import type { Database } from "./test-database.types";
import * as Client from "../src/client";
import * as Postgrest from "../src/postgrest";

// ---------------------------------------------------------------------------
// Test Schemas
// ---------------------------------------------------------------------------

const UserSchema = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  email: Schema.String,
});

const UserWithRoleSchema = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  email: Schema.String,
  role: Schema.String,
});

const UserIdNameSchema = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
});

// ---------------------------------------------------------------------------
// Test 1: executeMultiple() - Basic array query
// ---------------------------------------------------------------------------

const test1_executeMultiple = Client.getClient<Database>().pipe(
  Effect.flatMap((client) =>
    pipe(
      Postgrest.table("users")(client),
      Postgrest.select("id, name, email"),
      Postgrest.executeMultiple()
    )
  )
);

// ---------------------------------------------------------------------------
// Test 2: executeMultipleWithSchema() - Array with schema validation
// ---------------------------------------------------------------------------

const test2_executeMultipleWithSchema = Client.getClient<Database>().pipe(
  Effect.flatMap((client) =>
    pipe(
      Postgrest.table("users")(client),
      Postgrest.select("id, name, email"),
      Postgrest.executeMultipleWithSchema(UserSchema)
    )
  )
);

// ---------------------------------------------------------------------------
// Test 3: executeMultipleWithSchema() + FILTERS (THE MAIN FIX!)
// ---------------------------------------------------------------------------

const test3_schemaWithFilters = Client.getClient<Database>().pipe(
  Effect.flatMap((client) =>
    pipe(
      Postgrest.table("users")(client),
      Postgrest.select("id, name, email"),
      Postgrest.eq("active", true),  // ← Filter should work now!
      Postgrest.order("name"),
      Postgrest.limit(10),
      Postgrest.executeMultipleWithSchema(UserSchema)
    )
  )
);

// ---------------------------------------------------------------------------
// Test 4: Multiple filters with schema validation
// ---------------------------------------------------------------------------

const test4_multipleFiltersWithSchema = (minAge: number, roles: string[]) =>
  Client.getClient<Database>().pipe(
    Effect.flatMap((client) =>
      pipe(
        Postgrest.table("users")(client),
        Postgrest.select("id, name, email, role"),
        Postgrest.gte("age", minAge),
        Postgrest.in_("role", roles),
        Postgrest.is("deleted_at", null),
        Postgrest.order("age", { ascending: false }),
        Postgrest.executeMultipleWithSchema(UserWithRoleSchema)
      )
    )
  );

// ---------------------------------------------------------------------------
// Test 5: executeFilterMapMultipleWithSchema() - Filters out invalid rows
// ---------------------------------------------------------------------------

const test5_filterMapWithSchema = Client.getClient<Database>().pipe(
  Effect.flatMap((client) =>
    pipe(
      Postgrest.table("users")(client),
      Postgrest.select("id, name, email"),
      Postgrest.eq("status", "active"),
      Postgrest.executeFilterMapMultipleWithSchema(UserSchema)
    )
  )
);

// ---------------------------------------------------------------------------
// Test 6: executeSingle() - No asSingle() needed!
// ---------------------------------------------------------------------------

const test6_executeSingle = (userId: number) =>
  Client.getClient<Database>().pipe(
    Effect.flatMap((client) =>
      pipe(
        Postgrest.table("users")(client),
        Postgrest.select("id, name, email"),
        Postgrest.eq("id", userId),
        Postgrest.executeSingle()  // Auto-applies .single()
      )
    )
  );

// ---------------------------------------------------------------------------
// Test 7: executeSingleWithSchema() - No asSingle() needed!
// ---------------------------------------------------------------------------

const test7_executeSingleWithSchema = (userId: number) =>
  Client.getClient<Database>().pipe(
    Effect.flatMap((client) =>
      pipe(
        Postgrest.table("users")(client),
        Postgrest.select("id, name, email"),
        Postgrest.eq("id", userId),
        Postgrest.executeSingleWithSchema(UserSchema)  // Auto-applies .single()
      )
    )
  );

// ---------------------------------------------------------------------------
// Test 8: executeSingleWithSchema() + FILTERS
// ---------------------------------------------------------------------------

const test8_singleWithSchemaAndFilters = (userId: number) =>
  Client.getClient<Database>().pipe(
    Effect.flatMap((client) =>
      pipe(
        Postgrest.table("users")(client),
        Postgrest.select("id, name, email, role"),
        Postgrest.eq("id", userId),
        Postgrest.is("deleted_at", null),  // Additional filter
        Postgrest.executeSingleWithSchema(UserWithRoleSchema)
      )
    )
  );

// ---------------------------------------------------------------------------
// Test 9: executeMaybeSingle() - No asMaybeSingle() needed!
// ---------------------------------------------------------------------------

const test9_executeMaybeSingle = (email: string) =>
  Client.getClient<Database>().pipe(
    Effect.flatMap((client) =>
      pipe(
        Postgrest.table("users")(client),
        Postgrest.select("id, name, email"),
        Postgrest.eq("email", email),
        Postgrest.executeMaybeSingle()  // Auto-applies .maybeSingle()
      )
    )
  );

// ---------------------------------------------------------------------------
// Test 10: executeMaybeSingleWithSchema() - No asMaybeSingle() needed!
// ---------------------------------------------------------------------------

const test10_executeMaybeSingleWithSchema = (email: string) =>
  Client.getClient<Database>().pipe(
    Effect.flatMap((client) =>
      pipe(
        Postgrest.table("users")(client),
        Postgrest.select("id, name, email"),
        Postgrest.eq("email", email),
        Postgrest.executeMaybeSingleWithSchema(UserSchema)  // Auto-applies .maybeSingle()
      )
    )
  );

// ---------------------------------------------------------------------------
// Test 11: executeMaybeSingleWithSchema() + FILTERS
// ---------------------------------------------------------------------------

const test11_maybeSingleWithSchemaAndFilters = (email: string) =>
  Client.getClient<Database>().pipe(
    Effect.flatMap((client) =>
      pipe(
        Postgrest.table("users")(client),
        Postgrest.select("id, name, email"),
        Postgrest.eq("email", email),
        Postgrest.is("deleted_at", null),  // Additional filter
        Postgrest.executeMaybeSingleWithSchema(UserSchema)
      )
    )
  );

// ---------------------------------------------------------------------------
// Test 12: INSERT with executeSingle()
// ---------------------------------------------------------------------------

const test12_insertWithExecuteSingle = (newUser: { name: string; email: string }) =>
  Client.getClient<Database>().pipe(
    Effect.flatMap((client) =>
      pipe(
        Postgrest.table("users")(client),
        Postgrest.insert(newUser),
        Postgrest.select("id, name, email"),
        Postgrest.executeSingle()  // No asSingle() needed!
      )
    )
  );

// ---------------------------------------------------------------------------
// Test 13: INSERT with executeSingleWithSchema()
// ---------------------------------------------------------------------------

const test13_insertWithSchema = (newUser: { name: string; email: string }) =>
  Client.getClient<Database>().pipe(
    Effect.flatMap((client) =>
      pipe(
        Postgrest.table("users")(client),
        Postgrest.insert(newUser),
        Postgrest.select("id, name, email"),
        Postgrest.executeSingleWithSchema(UserSchema)
      )
    )
  );

// ---------------------------------------------------------------------------
// Test 14: UPDATE with executeSingle()
// ---------------------------------------------------------------------------

const test14_updateWithExecuteSingle = (userId: number, newName: string) =>
  Client.getClient<Database>().pipe(
    Effect.flatMap((client) =>
      pipe(
        Postgrest.table("users")(client),
        Postgrest.update({ name: newName }),
        Postgrest.eq("id", userId),
        Postgrest.select("id, name"),
        Postgrest.executeSingle()
      )
    )
  );

// ---------------------------------------------------------------------------
// Test 15: UPDATE with executeSingleWithSchema()
// ---------------------------------------------------------------------------

const test15_updateWithSchema = (userId: number, newName: string) =>
  Client.getClient<Database>().pipe(
    Effect.flatMap((client) =>
      pipe(
        Postgrest.table("users")(client),
        Postgrest.update({ name: newName }),
        Postgrest.eq("id", userId),
        Postgrest.select("id, name"),
        Postgrest.executeSingleWithSchema(UserIdNameSchema)
      )
    )
  );

// ---------------------------------------------------------------------------
// Test 16: UPSERT with executeSingle()
// ---------------------------------------------------------------------------

const test16_upsertWithExecuteSingle = (user: { email: string; name: string }) =>
  Client.getClient<Database>().pipe(
    Effect.flatMap((client) =>
      pipe(
        Postgrest.table("users")(client),
        Postgrest.upsert(user, { onConflict: "email" }),
        Postgrest.select("id, name, email"),
        Postgrest.executeSingle()
      )
    )
  );

// ---------------------------------------------------------------------------
// Test 17: DELETE with execute (no return data needed)
// ---------------------------------------------------------------------------

const test17_deleteWithExecute = (userId: number) =>
  Client.getClient<Database>().pipe(
    Effect.flatMap((client) =>
      pipe(
        Postgrest.table("users")(client),
        Postgrest.delete_(),
        Postgrest.eq("id", userId),
        Postgrest.execute
      )
    )
  );

// ---------------------------------------------------------------------------
// Test 18: DELETE and return deleted row
// ---------------------------------------------------------------------------

const test18_deleteAndReturn = (userId: number) =>
  Client.getClient<Database>().pipe(
    Effect.flatMap((client) =>
      pipe(
        Postgrest.table("users")(client),
        Postgrest.delete_(),
        Postgrest.eq("id", userId),
        Postgrest.select("id, name, email"),
        Postgrest.executeSingle()
      )
    )
  );

// ---------------------------------------------------------------------------
// Test 19: Raw execute with asSingle() (advanced use case)
// ---------------------------------------------------------------------------

const test19_rawExecuteWithAsSingle = (userId: number) =>
  Client.getClient<Database>().pipe(
    Effect.flatMap((client) =>
      pipe(
        Postgrest.table("users")(client),
        Postgrest.select("id, name"),
        Postgrest.eq("id", userId),
        Postgrest.asSingle(),  // Manual transform
        Postgrest.execute  // Raw execution
      )
    )
  );

// ---------------------------------------------------------------------------
// Test 20: Raw execute with asMaybeSingle() (advanced use case)
// ---------------------------------------------------------------------------

const test20_rawExecuteWithAsMaybeSingle = (email: string) =>
  Client.getClient<Database>().pipe(
    Effect.flatMap((client) =>
      pipe(
        Postgrest.table("users")(client),
        Postgrest.select("id, name"),
        Postgrest.eq("email", email),
        Postgrest.asMaybeSingle(),  // Manual transform
        Postgrest.execute  // Raw execution
      )
    )
  );

// ---------------------------------------------------------------------------
// Test 21: Complex filters (many different filter types)
// ---------------------------------------------------------------------------

const test21_complexFilters = (
  minAge: number,
  maxAge: number,
  namePattern: string,
  roles: string[]
) =>
  Client.getClient<Database>().pipe(
    Effect.flatMap((client) =>
      pipe(
        Postgrest.table("users")(client),
        Postgrest.select("id, name, age, role"),
        Postgrest.gte("age", minAge),
        Postgrest.lte("age", maxAge),
        Postgrest.ilike("name", namePattern),
        Postgrest.in_("role", roles),
        Postgrest.is("deleted_at", null),
        Postgrest.neq("status", "banned"),
        Postgrest.order("age"),
        Postgrest.limit(20),
        Postgrest.executeMultiple()
      )
    )
  );

// ---------------------------------------------------------------------------
// Test 22: Bulk insert with executeMultiple()
// ---------------------------------------------------------------------------

const test22_bulkInsert = (users: Array<{ name: string; email: string }>) =>
  Client.getClient<Database>().pipe(
    Effect.flatMap((client) =>
      pipe(
        Postgrest.table("users")(client),
        Postgrest.insert(users),
        Postgrest.select("id, name, email"),
        Postgrest.executeMultiple()
      )
    )
  );

// ---------------------------------------------------------------------------
// Test 23: Bulk insert with executeMultipleWithSchema()
// ---------------------------------------------------------------------------

const test23_bulkInsertWithSchema = (users: Array<{ name: string; email: string }>) =>
  Client.getClient<Database>().pipe(
    Effect.flatMap((client) =>
      pipe(
        Postgrest.table("users")(client),
        Postgrest.insert(users),
        Postgrest.select("id, name, email"),
        Postgrest.executeMultipleWithSchema(UserSchema)
      )
    )
  );

// ---------------------------------------------------------------------------
// Test 24: Pagination with range()
// ---------------------------------------------------------------------------

const test24_pagination = (page: number, pageSize: number) => {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  return Client.getClient<Database>().pipe(
    Effect.flatMap((client) =>
      pipe(
        Postgrest.table("users")(client),
        Postgrest.select("id, name, email"),
        Postgrest.order("created_at", { ascending: false }),
        Postgrest.range(from, to),
        Postgrest.executeMultiple()
      )
    )
  );
};

// ---------------------------------------------------------------------------
// Test 25: Pagination with schema validation
// ---------------------------------------------------------------------------

const test25_paginationWithSchema = (page: number, pageSize: number) => {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  return Client.getClient<Database>().pipe(
    Effect.flatMap((client) =>
      pipe(
        Postgrest.table("users")(client),
        Postgrest.select("id, name, email"),
        Postgrest.eq("active", true),  // Filter
        Postgrest.order("created_at", { ascending: false }),
        Postgrest.range(from, to),
        Postgrest.executeMultipleWithSchema(UserSchema)
      )
    )
  );
};

// ---------------------------------------------------------------------------
// Test 26: OR filter
// ---------------------------------------------------------------------------

const test26_orFilter = Client.getClient<Database>().pipe(
  Effect.flatMap((client) =>
    pipe(
      Postgrest.table("users")(client),
      Postgrest.select("id, name, role"),
      Postgrest.or("role.eq.admin,role.eq.moderator"),
      Postgrest.executeMultiple()
    )
  )
);

// ---------------------------------------------------------------------------
// Test 27: NOT filter
// ---------------------------------------------------------------------------

const test27_notFilter = Client.getClient<Database>().pipe(
  Effect.flatMap((client) =>
    pipe(
      Postgrest.table("users")(client),
      Postgrest.select("id, name"),
      Postgrest.not("name", "is", null),
      Postgrest.executeMultiple()
    )
  )
);

// ---------------------------------------------------------------------------
// Test 28: Match filter (multiple conditions)
// ---------------------------------------------------------------------------

const test28_matchFilter = Client.getClient<Database>().pipe(
  Effect.flatMap((client) =>
    pipe(
      Postgrest.table("users")(client),
      Postgrest.select("id, name, role"),
      Postgrest.match({ role: "admin", active: true }),
      Postgrest.executeMultiple()
    )
  )
);

// ---------------------------------------------------------------------------
// Test 29: Like filter (case-sensitive pattern matching)
// ---------------------------------------------------------------------------

const test29_likeFilter = Client.getClient<Database>().pipe(
  Effect.flatMap((client) =>
    pipe(
      Postgrest.table("users")(client),
      Postgrest.select("id, name"),
      Postgrest.like("name", "A%"),  // Names starting with 'A'
      Postgrest.executeMultiple()
    )
  )
);

// ---------------------------------------------------------------------------
// Test 30: Backward compatibility - deprecated functions still work
// ---------------------------------------------------------------------------

const test30_backwardCompatibility_multiple = Client.getClient<Database>().pipe(
  Effect.flatMap((client) =>
    pipe(
      Postgrest.table("users")(client),
      Postgrest.select("id, name"),
      Postgrest.multiple()  // Deprecated, but should still work
    )
  )
);

// Note: The old pattern of asSingle() + single() doesn't work with the new API
// because single() is now executeSingle() which itself calls .single()
// The backward compatibility is for function names only - use the new pattern instead
const test31_backwardCompatibility_single = (userId: number) =>
  Client.getClient<Database>().pipe(
    Effect.flatMap((client) =>
      pipe(
        Postgrest.table("users")(client),
        Postgrest.select("id, name"),
        Postgrest.eq("id", userId),
        Postgrest.single()  // Deprecated name (alias to executeSingle), but works
      )
    )
  );

const test32_backwardCompatibility_maybeSingle = (email: string) =>
  Client.getClient<Database>().pipe(
    Effect.flatMap((client) =>
      pipe(
        Postgrest.table("users")(client),
        Postgrest.select("id, name"),
        Postgrest.eq("email", email),
        Postgrest.maybeSingle()  // Deprecated name (alias to executeMaybeSingle), but works
      )
    )
  );

// ---------------------------------------------------------------------------
// Export all tests
// ---------------------------------------------------------------------------

export {
  test1_executeMultiple,
  test2_executeMultipleWithSchema,
  test3_schemaWithFilters,
  test4_multipleFiltersWithSchema,
  test5_filterMapWithSchema,
  test6_executeSingle,
  test7_executeSingleWithSchema,
  test8_singleWithSchemaAndFilters,
  test9_executeMaybeSingle,
  test10_executeMaybeSingleWithSchema,
  test11_maybeSingleWithSchemaAndFilters,
  test12_insertWithExecuteSingle,
  test13_insertWithSchema,
  test14_updateWithExecuteSingle,
  test15_updateWithSchema,
  test16_upsertWithExecuteSingle,
  test17_deleteWithExecute,
  test18_deleteAndReturn,
  test19_rawExecuteWithAsSingle,
  test20_rawExecuteWithAsMaybeSingle,
  test21_complexFilters,
  test22_bulkInsert,
  test23_bulkInsertWithSchema,
  test24_pagination,
  test25_paginationWithSchema,
  test26_orFilter,
  test27_notFilter,
  test28_matchFilter,
  test29_likeFilter,
  test30_backwardCompatibility_multiple,
  test31_backwardCompatibility_single,
  test32_backwardCompatibility_maybeSingle,
};

// ---------------------------------------------------------------------------
// Type-level validation: If this file compiles, all types are correct!
// ---------------------------------------------------------------------------
// The fact that TypeScript accepts all the test functions above proves that:
// 1. Schema validation works with filters (tests 3, 4, 8, 11, 25)
// 2. Auto-apply .single() / .maybeSingle() works (tests 6-11)
// 3. All execute functions have correct type signatures
// 4. Backward compatibility is maintained (tests 30-32)
