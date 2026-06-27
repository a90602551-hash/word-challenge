import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signTeacherToken, TEACHER_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    const teacher = await prisma.teacher.findUnique({ where: { email } });
    if (!teacher) return NextResponse.json({ error: "이메일을 찾을 수 없어요" }, { status: 401 });

    const ok = await bcrypt.compare(password, teacher.passwordHash);
    if (!ok) return NextResponse.json({ error: "비밀번호가 틀렸어요" }, { status: 401 });

    const token = await signTeacherToken(teacher.id);
    const res = NextResponse.json({ teacher: { id: teacher.id, name: teacher.name } });
    res.cookies.set(TEACHER_COOKIE, token, { httpOnly: true, path: "/", maxAge: 60 * 60 * 12, sameSite: "lax" });
    return res;
  } catch {
    return NextResponse.json({ error: "오류가 발생했어요" }, { status: 500 });
  }
}
