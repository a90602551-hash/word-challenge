import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signStudentToken, STUDENT_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    if (!username || !password)
      return NextResponse.json({ error: "아이디와 비밀번호를 입력해주세요" }, { status: 400 });

    const student = await prisma.student.findUnique({ where: { username } });
    if (!student)
      return NextResponse.json({ error: "아이디를 찾을 수 없어요" }, { status: 401 });

    const ok = await bcrypt.compare(password, student.passwordHash);
    if (!ok)
      return NextResponse.json({ error: "비밀번호가 틀렸어요" }, { status: 401 });

    const token = await signStudentToken(student.id);
    const res = NextResponse.json({ student: { id: student.id, name: student.name, avatar: student.avatar } });
    res.cookies.set(STUDENT_COOKIE, token, { httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax" });
    return res;
  } catch {
    return NextResponse.json({ error: "오류가 발생했어요" }, { status: 500 });
  }
}
