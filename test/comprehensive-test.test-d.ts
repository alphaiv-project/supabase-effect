/**
 * Comprehensive Type Test Suite
 *
 * Validates all execute variants, schema validation, CRUD operations, filters,
 * pagination, and backward compatibility. A test passes when its body compiles
 * without errors — TypeScript itself is the assertion engine.
 */

import { describe, it, expectTypeOf } from "vitest";
import { pipe } from "effect";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import type { Database } from "./test-database.types";
import * as Client from "../src/client";
import * as Postgrest from "../src/postgrest";
import type { PostgrestError } from "../src/postgrest-error";

// ---------------------------------------------------------------------------
// Shared schemas
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

type UserRow = { id: number; name: string; email: string };
type UserWithRoleRow = {
  id: number;
  name: string;
  email: string;
  role: string;
};
type UserIdNameRow = { id: number; name: string };

// ---------------------------------------------------------------------------
// executeMultiple
// ---------------------------------------------------------------------------

describe("executeMultiple", () => {
  it("returns Array<T> from a typed table", () => {
    const result = Client.getClient<Database>().pipe(
      Effect.flatMap((client) =>
        pipe(
          Postgrest.table("users")(client),
          Postgrest.select("id, name, email"),
          Postgrest.executeMultiple()
        )
      )
    );

    expectTypeOf(result).toEqualTypeOf<
      Effect.Effect<UserRow[], PostgrestError, Client.Client>
    >();
  });

  it("executeMultipleWithSchema decodes with schema", () => {
    const result = Client.getClient<Database>().pipe(
      Effect.flatMap((client) =>
        pipe(
          Postgrest.table("users")(client),
          Postgrest.select("id, name, email"),
          Postgrest.executeMultipleWithSchema(UserSchema)
        )
      )
    );

    expectTypeOf(result).not.toBeNever();
  });

  it("executeMultipleWithSchema composes with filters", () => {
    const result = Client.getClient<Database>().pipe(
      Effect.flatMap((client) =>
        pipe(
          Postgrest.table("users")(client),
          Postgrest.select("id, name, email"),
          Postgrest.eq("active", true),
          Postgrest.order("name"),
          Postgrest.limit(10),
          Postgrest.executeMultipleWithSchema(UserSchema)
        )
      )
    );

    expectTypeOf(result).not.toBeNever();
  });

  it("executeMultipleWithSchema composes with multiple filters", () => {
    const result = (minAge: number, roles: string[]) =>
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

    expectTypeOf(result(18, ["admin"])).not.toBeNever();
  });

  it("executeFilterMapMultipleWithSchema filters out decode failures", () => {
    const result = Client.getClient<Database>().pipe(
      Effect.flatMap((client) =>
        pipe(
          Postgrest.table("users")(client),
          Postgrest.select("id, name, email"),
          Postgrest.eq("status", "active"),
          Postgrest.executeFilterMapMultipleWithSchema(UserSchema)
        )
      )
    );

    expectTypeOf(result).not.toBeNever();
  });
});

// ---------------------------------------------------------------------------
// executeSingle
// ---------------------------------------------------------------------------

describe("executeSingle", () => {
  it("auto-applies .single() and returns a typed row", () => {
    const result = (userId: number) =>
      Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.table("users")(client),
            Postgrest.select("id, name, email"),
            Postgrest.eq("id", userId),
            Postgrest.executeSingle()
          )
        )
      );

    expectTypeOf(result(1)).toEqualTypeOf<
      Effect.Effect<UserRow, PostgrestError, Client.Client>
    >();
  });

  it("executeSingleWithSchema decodes with schema", () => {
    const result = (userId: number) =>
      Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.table("users")(client),
            Postgrest.select("id, name, email"),
            Postgrest.eq("id", userId),
            Postgrest.executeSingleWithSchema(UserSchema)
          )
        )
      );

    expectTypeOf(result(1)).not.toBeNever();
  });

  it("executeSingleWithSchema composes with filters", () => {
    const result = (userId: number) =>
      Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.table("users")(client),
            Postgrest.select("id, name, email, role"),
            Postgrest.eq("id", userId),
            Postgrest.is("deleted_at", null),
            Postgrest.executeSingleWithSchema(UserWithRoleSchema)
          )
        )
      );

    expectTypeOf(result(1)).not.toBeNever();
  });
});

// ---------------------------------------------------------------------------
// executeMaybeSingle
// ---------------------------------------------------------------------------

describe("executeMaybeSingle", () => {
  it("auto-applies .maybeSingle() and wraps result in Option", () => {
    const result = (email: string) =>
      Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.table("users")(client),
            Postgrest.select("id, name, email"),
            Postgrest.eq("email", email),
            Postgrest.executeMaybeSingle()
          )
        )
      );

    expectTypeOf(result("a@b.com")).toEqualTypeOf<
      Effect.Effect<Option.Option<UserRow>, PostgrestError, Client.Client>
    >();
  });

  it("executeMaybeSingleWithSchema decodes with schema", () => {
    const result = (email: string) =>
      Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.table("users")(client),
            Postgrest.select("id, name, email"),
            Postgrest.eq("email", email),
            Postgrest.executeMaybeSingleWithSchema(UserSchema)
          )
        )
      );

    expectTypeOf(result("a@b.com")).not.toBeNever();
  });

  it("executeMaybeSingleWithSchema composes with filters", () => {
    const result = (email: string) =>
      Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.table("users")(client),
            Postgrest.select("id, name, email"),
            Postgrest.eq("email", email),
            Postgrest.is("deleted_at", null),
            Postgrest.executeMaybeSingleWithSchema(UserSchema)
          )
        )
      );

    expectTypeOf(result("a@b.com")).not.toBeNever();
  });
});

// ---------------------------------------------------------------------------
// CRUD mutations
// ---------------------------------------------------------------------------

describe("insert", () => {
  it("insert + select + executeSingle compiles", () => {
    const result = (newUser: { name: string; email: string }) =>
      Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.table("users")(client),
            Postgrest.insert(newUser),
            Postgrest.select("id, name, email"),
            Postgrest.executeSingle()
          )
        )
      );

    expectTypeOf(
      result({ name: "Alice", email: "alice@example.com" })
    ).toEqualTypeOf<Effect.Effect<UserRow, PostgrestError, Client.Client>>();
  });

  it("insert + select + executeSingleWithSchema compiles", () => {
    const result = (newUser: { name: string; email: string }) =>
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

    expectTypeOf(result({ name: "Alice", email: "a@b.com" })).not.toBeNever();
  });

  it("bulk insert + select + executeMultiple compiles", () => {
    const result = (users: Array<{ name: string; email: string }>) =>
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

    expectTypeOf(result([])).toEqualTypeOf<
      Effect.Effect<UserRow[], PostgrestError, Client.Client>
    >();
  });

  it("bulk insert + select + executeMultipleWithSchema compiles", () => {
    const result = (users: Array<{ name: string; email: string }>) =>
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

    expectTypeOf(result([])).not.toBeNever();
  });
});

describe("update", () => {
  it("update + filter + select + executeSingle compiles", () => {
    const result = (userId: number, newName: string) =>
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

    expectTypeOf(result(1, "Alice")).toEqualTypeOf<
      Effect.Effect<UserIdNameRow, PostgrestError, Client.Client>
    >();
  });

  it("update + filter + select + executeSingleWithSchema compiles", () => {
    const result = (userId: number, newName: string) =>
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

    expectTypeOf(result(1, "Alice")).not.toBeNever();
  });
});

describe("upsert", () => {
  it("upsert + select + executeSingle compiles", () => {
    const result = (user: { email: string; name: string }) =>
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

    expectTypeOf(result({ email: "a@b.com", name: "Alice" })).toEqualTypeOf<
      Effect.Effect<UserRow, PostgrestError, Client.Client>
    >();
  });
});

describe("delete", () => {
  it("delete_ + filter + execute compiles", () => {
    const result = (userId: number) =>
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

    expectTypeOf(result(1)).not.toBeNever();
  });

  it("delete_ + filter + select + executeSingle compiles", () => {
    const result = (userId: number) =>
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

    expectTypeOf(result(1)).toEqualTypeOf<
      Effect.Effect<UserRow, PostgrestError, Client.Client>
    >();
  });
});

// ---------------------------------------------------------------------------
// Raw execute with manual transforms
// ---------------------------------------------------------------------------

describe("raw execute with manual transforms", () => {
  it("asSingle() + execute compiles", () => {
    const result = (userId: number) =>
      Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.table("users")(client),
            Postgrest.select("id, name"),
            Postgrest.eq("id", userId),
            Postgrest.asSingle(),
            Postgrest.execute
          )
        )
      );

    expectTypeOf(result(1)).not.toBeNever();
  });

  it("asMaybeSingle() + execute compiles", () => {
    const result = (email: string) =>
      Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.table("users")(client),
            Postgrest.select("id, name"),
            Postgrest.eq("email", email),
            Postgrest.asMaybeSingle(),
            Postgrest.execute
          )
        )
      );

    expectTypeOf(result("a@b.com")).not.toBeNever();
  });
});

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

describe("filters", () => {
  it("complex filter chain compiles", () => {
    const result = (
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

    expectTypeOf(result(18, 65, "A%", ["admin"])).not.toBeNever();
  });

  it("or filter compiles", () => {
    const result = Client.getClient<Database>().pipe(
      Effect.flatMap((client) =>
        pipe(
          Postgrest.table("users")(client),
          Postgrest.select("id, name, role"),
          Postgrest.or("role.eq.admin,role.eq.moderator"),
          Postgrest.executeMultiple()
        )
      )
    );

    expectTypeOf(result).not.toBeNever();
  });

  it("not filter compiles", () => {
    const result = Client.getClient<Database>().pipe(
      Effect.flatMap((client) =>
        pipe(
          Postgrest.table("users")(client),
          Postgrest.select("id, name"),
          Postgrest.not("name", "is", null),
          Postgrest.executeMultiple()
        )
      )
    );

    expectTypeOf(result).not.toBeNever();
  });

  it("match filter compiles", () => {
    const result = Client.getClient<Database>().pipe(
      Effect.flatMap((client) =>
        pipe(
          Postgrest.table("users")(client),
          Postgrest.select("id, name, role"),
          Postgrest.match({ role: "admin", active: true }),
          Postgrest.executeMultiple()
        )
      )
    );

    expectTypeOf(result).not.toBeNever();
  });

  it("like filter compiles", () => {
    const result = Client.getClient<Database>().pipe(
      Effect.flatMap((client) =>
        pipe(
          Postgrest.table("users")(client),
          Postgrest.select("id, name"),
          Postgrest.like("name", "A%"),
          Postgrest.executeMultiple()
        )
      )
    );

    expectTypeOf(result).not.toBeNever();
  });
});

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

describe("pagination", () => {
  it("range() compiles", () => {
    const result = (page: number, pageSize: number) => {
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

    expectTypeOf(result(0, 10)).toEqualTypeOf<
      Effect.Effect<UserRow[], PostgrestError, Client.Client>
    >();
  });

  it("range() with filter + schema compiles", () => {
    const result = (page: number, pageSize: number) => {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      return Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.table("users")(client),
            Postgrest.select("id, name, email"),
            Postgrest.eq("active", true),
            Postgrest.order("created_at", { ascending: false }),
            Postgrest.range(from, to),
            Postgrest.executeMultipleWithSchema(UserSchema)
          )
        )
      );
    };

    expectTypeOf(result(0, 10)).not.toBeNever();
  });
});

// ---------------------------------------------------------------------------
// Backward compatibility (deprecated aliases)
// ---------------------------------------------------------------------------

describe("backward compatibility", () => {
  it("deprecated multiple() alias compiles", () => {
    const result = Client.getClient<Database>().pipe(
      Effect.flatMap((client) =>
        pipe(
          Postgrest.table("users")(client),
          Postgrest.select("id, name"),
          Postgrest.multiple()
        )
      )
    );

    expectTypeOf(result).not.toBeNever();
  });

  it("deprecated single() alias compiles", () => {
    const result = (userId: number) =>
      Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.table("users")(client),
            Postgrest.select("id, name"),
            Postgrest.eq("id", userId),
            Postgrest.single()
          )
        )
      );

    expectTypeOf(result(1)).not.toBeNever();
  });

  it("deprecated maybeSingle() alias compiles", () => {
    const result = (email: string) =>
      Client.getClient<Database>().pipe(
        Effect.flatMap((client) =>
          pipe(
            Postgrest.table("users")(client),
            Postgrest.select("id, name"),
            Postgrest.eq("email", email),
            Postgrest.maybeSingle()
          )
        )
      );

    expectTypeOf(result("a@b.com")).not.toBeNever();
  });
});

// Suppress unused-import warnings for type imports used only in expectTypeOf.
export type { UserWithRoleRow };
