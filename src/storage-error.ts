import { SupabaseClient } from "@supabase/supabase-js";
import * as Data from "effect/Data";

/**
 * Supabase's original storage error type.
 *
 * NOTE: This should be exposed directly from the `@supabase/supabase-js` package, but is not.
 * When supported, replace this type def with the package's one.
 */
type SupabaseStorageError = NonNullable<
  Awaited<ReturnType<SupabaseClient["storage"]["createBucket"]>>["error"]
>;

/**
 * Data.TaggedError wrapper for `@supabase/supabase-js`'s StorageError.
 */
export class StorageError extends Data.TaggedError(
  "supabase-effect/StorageError"
)<{
  inner: SupabaseStorageError;
}> {
  constructor(inner: SupabaseStorageError) {
    super({ inner });
  }
}
