import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

/**
 * Schema type that does not require any decoding services.
 *
 * @typeParam A - The type of the decoded value.
 * @internal
 */
export type PureSchema<A> = Schema.Schema<A> & { DecodingServices: never };

/**
 * Schema type that has specific encoding type.
 *
 * @typeParam A - The type of the decoded value.
 * @typeParam I - The type of the encoded value.
 * @internal
 */
export type PureSchemaWithEncodedType<A, I> = PureSchema<A> & { Encoded: I };

/**
 * Decodes an `I` into an `Effect.Effect<A, Schema.SchemaError>` using the provided pure schema.
 *
 * @param s the pure schema with decoded `A`, encoded `I`.
 * @returns a function that decodes an `I` into an `Effect.Effect<A, Schema.SchemaError>`.
 * @internal
 */
export function decodePure<A, I>(
  s: PureSchemaWithEncodedType<A, I>
): (input: I) => Effect.Effect<A, Schema.SchemaError> {
  return Schema.decodeEffect(s);
}

/**
 * Decodes an `I` into an `Effect.Effect<Result.Result<A, Schema.SchemaError>>` using the provided pure schema.
 *
 * @param s the pure schema with decoded `A`, encoded `I`.
 * @returns a function that decodes an `I` into an `Effect.Effect<Result.Result<A, Schema.SchemaError>>`.
 * @internal
 */
export function decodePureResult<A, I>(
  s: PureSchemaWithEncodedType<A, I>
): (input: I) => Effect.Effect<Result.Result<A, Schema.SchemaError>> {
  return (input: I) => Schema.decodeEffect(s)(input).pipe(Effect.result);
}
