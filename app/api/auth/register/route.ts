import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signStudentToken, STUDENT_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { name, username: rawUsername, password, avatar, isEnrolled, parentName, parentPhone } = await req.json();
    const username = rawUsername?.trim() ?? "";
    const cleanName = name?.trim() ?? "";

    if (!cleanName || !username || !password?.trim())
      return NextResponse.json({ error: "이름, 아이디, 비밀번호를 모두 입력해주세요" }, { status: 400 });
    if (username.length < 2)
      return NextResponse.json({ error: "아이디는 2자 이상이어야 해요" }, { status: 400 });
    if (password.length < 4)
      return NextResponse.json({ error: "비밀번호는 4자 이상이어야 해요" }, { status: 400 });

    // 대소문자 구분 없이 중복 체크
    const exists = await prisma.student.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
    });
    if (exists) return NextResponse.json({ error: "이미 사용 중인 아이디예요" }, { status: 400 });

    const passwordHash = await bcrypt.hash(password, 10);
    const student = await prisma.student.create({
      data: {
        name: cleanName, username, passwordHash, avatar: avatar || "🐥",
        isEnrolled: isEnrolled !== false,
        parentName: isEnrolled === false ? (parentName?.trim() || null) : null,
        parentPhone: isEnrolled === false ? (parentPhone?.trim() || null) : null,
      },
    });

    const token = await signStudentToken(student.id);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(STUDENT_COOKIE, token, { httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 30 });
    return res;
  } catch {
    return NextResponse.json({ error: "오류가 발생했어요" }, { status: 500 });
  }
}
