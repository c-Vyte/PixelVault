import { NextRequest } from "next/server";

const CHUNK_SIZE = 1024 * 1024;
const MAX_BYTES = 500 * 1024 * 1024;

export async function GET(request: NextRequest) {
  const requested = parseInt(request.nextUrl.searchParams.get("bytes") || "", 10);
  const bytes =
    Number.isFinite(requested) && requested > 0 ? Math.min(requested, MAX_BYTES) : 50 * 1024 * 1024;

  const seed = new Uint8Array(CHUNK_SIZE);
  for (let i = 0; i < CHUNK_SIZE; i += 4096) {
    crypto.getRandomValues(seed.subarray(i, Math.min(i + 4096, CHUNK_SIZE)));
  }

  let remaining = bytes;
  const stream = new ReadableStream({
    pull(controller) {
      if (remaining <= 0) {
        controller.close();
        return;
      }
      const size = Math.min(remaining, CHUNK_SIZE);
      remaining -= size;
      controller.enqueue(seed.subarray(0, size));
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
