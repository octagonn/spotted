import { AwsClient } from "npm:aws4fetch@1.0.20";

/**
 * Shared Cloudflare R2 (S3-compatible) helpers for edge functions.
 * Env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.
 */

export type R2 = { aws: AwsClient; base: string };

export function r2FromEnv(): R2 | null {
  const accountId = Deno.env.get("R2_ACCOUNT_ID");
  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
  const bucket = Deno.env.get("R2_BUCKET");
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return {
    aws: new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" }),
    base: `https://${accountId}.r2.cloudflarestorage.com/${bucket}`
  };
}

/** Presigned URL for a single object (GET/PUT/DELETE). */
export async function presign(
  r2: R2,
  method: "GET" | "PUT" | "DELETE",
  key: string,
  ttlSeconds: number
): Promise<string> {
  const url = new URL(`${r2.base}/${key}`);
  url.searchParams.set("X-Amz-Expires", String(ttlSeconds));
  const signed = await r2.aws.sign(new Request(url.toString(), { method }), {
    aws: { signQuery: true }
  });
  return signed.url;
}

/** Server-side PUT (used by migration). Returns true on success. */
export async function putObject(r2: R2, key: string, body: ArrayBuffer, contentType: string): Promise<boolean> {
  const res = await r2.aws.fetch(`${r2.base}/${key}`, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body
  });
  if (!res.ok) await res.text().catch(() => {});
  return res.ok;
}

/** Object size in bytes via HEAD, or null when missing. */
export async function headObject(r2: R2, key: string): Promise<number | null> {
  const res = await r2.aws.fetch(`${r2.base}/${key}`, { method: "HEAD" });
  if (!res.ok) return null;
  const len = res.headers.get("content-length");
  return len ? Number(len) : null;
}

/** All keys under a prefix (paginated ListObjectsV2). */
export async function listPrefix(r2: R2, prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const url = new URL(r2.base);
    url.searchParams.set("list-type", "2");
    url.searchParams.set("prefix", prefix);
    if (token) url.searchParams.set("continuation-token", token);
    const res = await r2.aws.fetch(url.toString());
    if (!res.ok) break;
    const xml = await res.text();
    for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) keys.push(m[1]);
    token = xml.match(/<NextContinuationToken>([^<]+)</)?.[1];
  } while (token);
  return keys;
}

/** Delete one object; true when gone (including already-absent). */
export async function deleteObject(r2: R2, key: string): Promise<boolean> {
  const res = await r2.aws.fetch(`${r2.base}/${key}`, { method: "DELETE" });
  return res.ok || res.status === 404;
}

/** Delete everything under a prefix. Returns count deleted. */
export async function purgePrefix(r2: R2, prefix: string): Promise<number> {
  const keys = await listPrefix(r2, prefix);
  let deleted = 0;
  for (const key of keys) {
    if (await deleteObject(r2, key)) deleted += 1;
  }
  return deleted;
}
