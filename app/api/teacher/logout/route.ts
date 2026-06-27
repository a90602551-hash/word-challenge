import { NextResponse } from "next/server";
import { TEACHER_COOKIE } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(TEACHER_COOKIE, "", { maxAge: 0, path: "/" });
  return res;
}
