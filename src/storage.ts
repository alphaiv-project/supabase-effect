import * as Effect from "effect/Effect";
import * as ServiceMap from "effect/ServiceMap";
import { getClient } from "./client";
import { StorageError, SupabaseStorageError } from "./storage-error";
import * as Option from "effect/Option";

/**
 * @internal
 */
const flatMapStorageResponse = <T>(
  authResponse: Effect.Effect<
    | {
        data: T;
        error: null;
      }
    | {
        data: unknown;
        error: SupabaseStorageError;
      }
  >
): Effect.Effect<T, StorageError> =>
  Effect.flatMap(authResponse, (res) =>
    res.error
      ? Effect.fail(new StorageError(res.error))
      : Effect.succeed(res.data)
  );

export class Storage extends ServiceMap.Service<Storage>()(
  "supabase-effect/Storage",
  {
    make: Effect.gen(function* () {
      const client = (yield* getClient()).storage;
      type CertainStorageClient = ReturnType<typeof client.from>;

      const createBucket = (...args: Parameters<typeof client.createBucket>) =>
        Effect.promise(() => client.createBucket(...args)).pipe(
          flatMapStorageResponse,
          Effect.map(Option.fromNullOr)
        );

      const deleteBucket = (...args: Parameters<typeof client.deleteBucket>) =>
        Effect.promise(() => client.deleteBucket(...args)).pipe(
          flatMapStorageResponse,
          Effect.map((res) => Option.fromUndefinedOr(res?.message))
        );

      const emptyBucket = (...args: Parameters<typeof client.emptyBucket>) =>
        Effect.promise(() => client.emptyBucket(...args)).pipe(
          flatMapStorageResponse,
          Effect.map((res) => Option.fromUndefinedOr(res?.message))
        );

      const copy = (
        bucket: string,
        ...args: Parameters<CertainStorageClient["copy"]>
      ) =>
        Effect.promise(() => client.from(bucket).copy(...args)).pipe(
          flatMapStorageResponse,
          Effect.map((res) => Option.fromUndefinedOr(res?.path))
        );

      const createSignedUploadUrl = (
        bucket: string,
        ...args: Parameters<CertainStorageClient["createSignedUploadUrl"]>
      ) =>
        Effect.promise(() =>
          client.from(bucket).createSignedUploadUrl(...args)
        ).pipe(flatMapStorageResponse);

      const createSignedUrl = (
        bucket: string,
        ...args: Parameters<CertainStorageClient["createSignedUrl"]>
      ) =>
        Effect.promise(() => client.from(bucket).createSignedUrl(...args)).pipe(
          flatMapStorageResponse
        );

      const createSignedUrls = (
        bucket: string,
        ...args: Parameters<CertainStorageClient["createSignedUrls"]>
      ) =>
        Effect.promise(() =>
          client.from(bucket).createSignedUrls(...args)
        ).pipe(flatMapStorageResponse);

      const download = (
        bucket: string,
        ...args: Parameters<CertainStorageClient["download"]>
      ) =>
        Effect.promise(() => client.from(bucket).download(...args)).pipe(
          flatMapStorageResponse
        );

      const exists = (
        bucket: string,
        ...args: Parameters<CertainStorageClient["exists"]>
      ) =>
        Effect.promise(() => client.from(bucket).exists(...args)).pipe(
          flatMapStorageResponse
        );

      const getPublicUrl = (
        bucket: string,
        ...args: Parameters<CertainStorageClient["getPublicUrl"]>
      ) =>
        Effect.sync(() => client.from(bucket).getPublicUrl(...args)).pipe(
          Effect.map((res) => res.data.publicUrl)
        );

      const info = (
        bucket: string,
        ...args: Parameters<CertainStorageClient["info"]>
      ) =>
        Effect.promise(() => client.from(bucket).info(...args)).pipe(
          flatMapStorageResponse,
          Effect.map(Option.fromNullOr)
        );

      const list = (
        bucket: string,
        ...args: Parameters<CertainStorageClient["list"]>
      ) =>
        Effect.promise(() => client.from(bucket).list(...args)).pipe(
          flatMapStorageResponse,
          Effect.map((res) => res ?? [])
        );

      const listV2 = (
        bucket: string,
        ...args: Parameters<CertainStorageClient["listV2"]>
      ) =>
        Effect.promise(() => client.from(bucket).listV2(...args)).pipe(
          flatMapStorageResponse,
          Effect.map(Option.fromNullOr)
        );

      const move = (
        bucket: string,
        ...args: Parameters<CertainStorageClient["move"]>
      ) =>
        Effect.promise(() => client.from(bucket).move(...args)).pipe(
          flatMapStorageResponse,
          Effect.map((res) => Option.fromUndefinedOr(res?.message))
        );

      const remove = (
        bucket: string,
        ...args: Parameters<CertainStorageClient["remove"]>
      ) =>
        Effect.promise(() => client.from(bucket).remove(...args)).pipe(
          flatMapStorageResponse,
          Effect.map((res) => res ?? [])
        );

      const update = (
        bucket: string,
        ...args: Parameters<CertainStorageClient["update"]>
      ) =>
        Effect.promise(() => client.from(bucket).update(...args)).pipe(
          flatMapStorageResponse,
          Effect.map(Option.fromNullOr)
        );

      const upload = (
        bucket: string,
        ...args: Parameters<CertainStorageClient["upload"]>
      ) =>
        Effect.promise(() => client.from(bucket).upload(...args)).pipe(
          flatMapStorageResponse,
          Effect.map(Option.fromNullOr)
        );

      const uploadToSignedUrl = (
        bucket: string,
        ...args: Parameters<CertainStorageClient["uploadToSignedUrl"]>
      ) =>
        Effect.promise(() =>
          client.from(bucket).uploadToSignedUrl(...args)
        ).pipe(flatMapStorageResponse, Effect.map(Option.fromNullOr));

      const getBucket = (...args: Parameters<typeof client.getBucket>) =>
        Effect.promise(() => client.getBucket(...args)).pipe(
          flatMapStorageResponse,
          Effect.map(Option.fromNullOr)
        );

      const listBuckets = (...args: Parameters<typeof client.listBuckets>) =>
        Effect.promise(() => client.listBuckets(...args)).pipe(
          flatMapStorageResponse,
          Effect.map((res) => res ?? [])
        );

      const updateBucket = (...args: Parameters<typeof client.updateBucket>) =>
        Effect.promise(() => client.updateBucket(...args)).pipe(
          flatMapStorageResponse,
          Effect.map((res) => Option.fromUndefinedOr(res?.message))
        );

      return {
        /**
         * Creates a new Storage bucket.
         *
         * @category File Buckets
         */
        createBucket,

        /**
         * Deletes an existing bucket. A bucket can't be deleted with existing
         * objects inside it. You must first `emptyBucket()` the bucket.
         *
         * @category File Buckets
         * @param id The unique identifier of the bucket you would like to delete.
         */
        deleteBucket,

        /**
         * Removes all objects inside a single bucket.
         *
         * @category File Buckets
         * @param id The unique identifier of the bucket you would like to empty.
         */
        emptyBucket,

        /**
         * Copies an existing file to a new path in the same bucket.
         *
         * @category File Buckets
         * @param bucket The bucket to operate on.
         * @param fromPath The original file path, including the current file
         * name. For example `folder/image.png`.
         * @param toPath The new file path, including the new file name. For
         * example `folder/image-copy.png`.
         */
        copy,

        /**
         * Creates a signed upload URL. Signed upload URLs can be used to upload
         * files to the bucket without further authentication. They are valid for
         * 2 hours.
         *
         * @category File Buckets
         * @param bucket The bucket to operate on.
         * @param path The file path, including the current file name. For
         * example `folder/image.png`.
         * @param options.upsert If set to `true`, allows the file to be
         * overwritten if it already exists.
         */
        createSignedUploadUrl,

        /**
         * Creates a signed URL. Use a signed URL to share a file for a fixed
         * amount of time.
         *
         * @category File Buckets
         * @param bucket The bucket to operate on.
         * @param path The file path, including the current file name. For
         * example `folder/image.png`.
         * @param expiresIn The number of seconds until the signed URL expires.
         * For example, `60` for a URL which is valid for one minute.
         * @param options.download Triggers the file as a download if set to
         * `true`. Set this parameter as the name of the file if you want to
         * trigger the download with a different filename.
         * @param options.transform Transform the asset before serving it to the
         * client.
         */
        createSignedUrl,

        /**
         * Creates multiple signed URLs. Use a signed URL to share a file for a
         * fixed amount of time.
         *
         * @category File Buckets
         * @param bucket The bucket to operate on.
         * @param paths The file paths to be downloaded, including the current
         * file names. For example `['folder/image.png', 'folder2/image2.png']`.
         * @param expiresIn The number of seconds until the signed URLs expire.
         * For example, `60` for URLs which are valid for one minute.
         * @param options.download Triggers the file as a download if set to
         * `true`. Set this parameter as the name of the file if you want to
         * trigger the download with a different filename.
         */
        createSignedUrls,

        /**
         * Downloads a file from a private bucket. For public buckets, make a
         * request to the URL returned from `getPublicUrl` instead.
         *
         * @category File Buckets
         * @param bucket The bucket to operate on.
         * @param path The full path and file name of the file to be downloaded.
         * For example `folder/image.png`.
         * @param options.transform Transform the asset before serving it to the
         * client.
         * @param parameters Additional fetch parameters like `signal` for
         * cancellation. Supports standard fetch options including cache control.
         */
        download,

        /**
         * Checks the existence of a file.
         *
         * @category File Buckets
         * @param bucket The bucket to operate on.
         * @param path The file path, including the file name. For example
         * `folder/image.png`.
         */
        exists,

        /**
         * A simple convenience function to get the URL for an asset in a public
         * bucket. If you do not want to use this function, you can construct the
         * public URL by concatenating the bucket URL with the path to the asset.
         *
         * This function does not verify if the bucket is public. If a public URL
         * is created for a bucket which is not public, you will not be able to
         * download the asset.
         *
         * @category File Buckets
         * @param bucket The bucket to operate on.
         * @param path The path and name of the file to generate the public URL
         * for. For example `folder/image.png`.
         */
        getPublicUrl,

        /**
         * Retrieves the details of an existing file.
         *
         * Returns detailed file metadata including size, content type, and
         * timestamps. Note: The API returns a `last_modified` field, not
         * `updated_at`.
         *
         * @category File Buckets
         * @param bucket The bucket to operate on.
         * @param path The file path, including the file name. For example
         * `folder/image.png`.
         */
        info,

        /**
         * Lists all the files and folders within a path of the bucket.
         *
         * **Important:** For folder entries, fields like `id`, `updated_at`,
         * `created_at`, `last_accessed_at`, and `metadata` will be `null`. Only
         * files have these fields populated. Additionally, deprecated fields like
         * `bucket_id`, `owner`, and `buckets` are NOT returned by this method.
         *
         * @category File Buckets
         * @param bucket The bucket to operate on.
         * @param path The folder path.
         * @param options Search options including `limit` (defaults to 100),
         * `offset`, `sortBy`, and `search`.
         * @param parameters Optional fetch parameters including `signal` for
         * cancellation.
         */
        list,

        /**
         * Lists all the files and folders within a bucket using the V2 API with
         * pagination support.
         *
         * **Important:** Folder entries in the `folders` array only contain
         * `name` and optionally `key` — they have no `id`, timestamps, or
         * metadata fields. Full file metadata is only available on entries in the
         * `objects` array.
         *
         * @experimental This method signature might change in the future.
         * @category File Buckets
         * @param bucket The bucket to operate on.
         * @param options Search options including `prefix`, `cursor` for
         * pagination, `limit`, and `with_delimiter`.
         * @param parameters Optional fetch parameters including `signal` for
         * cancellation.
         */
        listV2,

        /**
         * Moves an existing file to a new path in the same bucket.
         *
         * @category File Buckets
         * @param bucket The bucket to operate on.
         * @param fromPath The original file path, including the current file
         * name. For example `folder/image.png`.
         * @param toPath The new file path, including the new file name. For
         * example `folder/image-new.png`.
         * @param options The destination options.
         */
        move,

        /**
         * Deletes files within the same bucket.
         *
         * Returns an array of `FileObject` entries for the deleted files. Note
         * that deprecated fields like `bucket_id` may or may not be present in
         * the response — do not rely on them.
         *
         * @category File Buckets
         * @param bucket The bucket to operate on.
         * @param paths An array of files to delete, including the path and file
         * name. For example `['folder/image.png']`.
         */
        remove,

        /**
         * Replaces an existing file at the specified path with a new one.
         *
         * @category File Buckets
         * @param bucket The bucket to operate on.
         * @param path The relative file path. Should be of the format
         * `folder/subfolder/filename.png`. The bucket must already exist before
         * attempting to update.
         * @param fileBody The body of the file to be stored in the bucket.
         * @param fileOptions Optional file upload options including
         * `cacheControl`, `contentType`, `upsert`, and `metadata`.
         */
        update,

        /**
         * Uploads a file to an existing bucket.
         *
         * @category File Buckets
         * @param bucket The bucket to operate on.
         * @param path The file path, including the file name. Should be of the
         * format `folder/subfolder/filename.png`. The bucket must already exist
         * before attempting to upload.
         * @param fileBody The body of the file to be stored in the bucket.
         * @param fileOptions Optional file upload options including
         * `cacheControl`, `contentType`, `upsert`, and `metadata`.
         */
        upload,

        /**
         * Uploads a file with a token generated from `createSignedUploadUrl`.
         *
         * @category File Buckets
         * @param bucket The bucket to operate on.
         * @param path The file path, including the file name. Should be of the
         * format `folder/subfolder/filename.png`. The bucket must already exist
         * before attempting to upload.
         * @param token The token generated from `createSignedUploadUrl`.
         * @param fileBody The body of the file to be stored in the bucket.
         * @param fileOptions HTTP headers (`cacheControl`, `contentType`, etc.).
         * Note: The `upsert` option has no effect here. To enable upsert
         * behavior, pass `{ upsert: true }` when calling
         * `createSignedUploadUrl()` instead.
         */
        uploadToSignedUrl,

        /**
         * Retrieves the details of an existing Storage bucket.
         *
         * @category File Buckets
         * @param id The unique identifier of the bucket you would like to
         * retrieve.
         */
        getBucket,

        /**
         * Retrieves the details of all Storage buckets within an existing
         * project.
         *
         * @category File Buckets
         * @param options Query parameters for listing buckets.
         * @param options.limit Maximum number of buckets to return.
         * @param options.offset Number of buckets to skip.
         * @param options.sortColumn Column to sort by (`'id'`, `'name'`,
         * `'created_at'`, `'updated_at'`).
         * @param options.sortOrder Sort order (`'asc'` or `'desc'`).
         * @param options.search Search term to filter bucket names.
         */
        listBuckets,

        /**
         * Updates a Storage bucket.
         *
         * @category File Buckets
         * @param id A unique identifier for the bucket you are updating.
         * @param options.public The visibility of the bucket. Public buckets
         * don't require an authorization token to download objects, but still
         * require a valid token for all other operations.
         * @param options.fileSizeLimit Specifies the max file size in bytes that
         * can be uploaded to this bucket. The global file size limit takes
         * precedence over this value. The default value is `null`, which doesn't
         * set a per-bucket file size limit.
         * @param options.allowedMimeTypes Specifies the allowed mime types that
         * this bucket can accept during upload. The default value is `null`,
         * which allows files with all mime types to be uploaded. Each mime type
         * specified can be a wildcard, e.g. `image/*`, or a specific mime type,
         * e.g. `image/png`.
         */
        updateBucket,
      };
    }),
  }
) {}
