import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  if (!request.body) {
    return NextResponse.json({ error: "Missing body" }, { status: 400 });
  }
  const reader = request.body.getReader();
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
  }
  return NextResponse.json({ bytes });
}
