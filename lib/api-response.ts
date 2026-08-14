import { NextResponse } from "next/server";

export function ok(data: unknown = { success: true }, status = 200) {
  return NextResponse.json(data, { status });
}

export function err(
  message: string,
  status = 500,
  code?: string,
  fields?: Record<string, string>,
) {
  return NextResponse.json(
    {
      error: message,
      ...(code ? { code } : {}),
      ...(fields ? { fields } : {}),
    },
    { status },
  );
}
