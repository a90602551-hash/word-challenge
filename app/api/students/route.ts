import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getTeacherId } from "@/lib/auth";

// GET /api/students
export async function GET(req: Request) {
  const tid = await getTeacherId(req);
  if (!tid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const students = await prisma.student.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, username: true, avatar: true, createdAt: true },
  });
  return NextResponse.json(students);
}

// POST /api/students  { name, username, password, avatar }
export async function POST(req: Request) {
  const tid = await getTeacherId(req);
  if (!tid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { name, username, password, avatar } = await req.json();
    if (!name || !username || !password)
      return NextResponse.json({ error: "이름, 아이디, 비밀번호는 필수입니다" }, { status: 400 });

    const exists = await prisma.student.findUnique({ where: { username } });
    if (exists) return NextResponse.json({ error: "이미 사용 중인 아이디예요" }, { status: 400 });

    const passwordHash = await bcrypt.hash(password, 10);
    const student = await prisma.student.create({
      data: { name, username, passwordHash, avatar: avatar || "🐥" },
    });
    return NextResponse.json(student, { status: 201 });
  } catch {
    return NextResponse.json({ error: "오류가 발생했어요" }, { status: 500 });
  }
}
