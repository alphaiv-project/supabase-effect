import { Data } from "effect";
import { type PostgrestError as SupabasePostgrestError } from "@supabase/supabase-js";

/**
 * A tagged error class for `@supabase/supabase-js`'s PostgrestError
 */
export class PostgrestError extends Data.TaggedError(
  "effect-supabase/PostgrestError"
)<{
  e: SupabasePostgrestError;
}> {
  constructor(e: SupabasePostgrestError) {
    super({ e });
  }
}
