import { describe, it, expectTypeOf } from "vitest";
import { pipe } from "effect";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import type { Database } from "../test-database.types";
import * as Client from "../../src/client";
import * as Postgrest from "../../src/postgrest";
import type { PostgrestError } from "../../src/postgrest-error";

type UserRow = { id: number; name: string; email: string };
type UserIdNameRow = { id: number; name: string };

describe("complex piping", () => {
  it("", () => {
    const result = pipe(
      Postgrest.from("users"),
      Postgrest.select("id,name,email"),
      Postgrest.executeMultiple()
    );

    expectTypeOf<typeof result>().toEqualTypeOf<
      Effect.Effect<UserRow[], PostgrestError, Client.Client>
    >();
  });
});
