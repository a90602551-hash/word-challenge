import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signStudentToken, STUDENT_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { name, username, password, avatar } = await req.json();
    if (!name?.trim() || !username?.trim() || !password?.trim())
      return NextResponse.json({ error: "이름, 아이디, 비밀번호를 모두 입력해주세요" }, { status: 400 });

    if (username.length < 2)
      return NextResponse.json({ error: "아이디는 2자 이상이어야 해요" }, { status: 400 });
    if (password.length < 4)
      return NextResponse.json({ error: "비밀번호는 4자 이상이어야 해요" }, { status: 400 });

    const exists = await prisma.student.findUnique({ where: { username } });
    if (exists) return NextResponse.json({ error: "이미 사용 중인 아이디예요" }, { status: 400 });

    const passwordHash = await bcrypt.hash(password, 10);
    const student = await prisma.student.create({
      data: { name: name.trim(), username: username.trim(), passwordHash, avatar: avatar || "🐥" },
    });

    const token = await signStudentToken(student.id);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(STUDENT_COOKIE, token, { httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 30 });
    return res;
  } catch {
    return NextResponse.json({ error: "오류가 발생했어요" }, { status: 500 });
  }
}
