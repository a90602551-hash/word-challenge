import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getTeacherId } from "@/lib/auth";

// POST /api/students/bulk  { students: [{ name, username, password, avatar }] }
export async function POST(req: Request) {
  const tid = await getTeacherId(req);
  if (!tid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { students } = await req.json();
    if (!Array.isArray(students) || students.length === 0)
      return NextResponse.json({ error: "학생 데이터가 없어요" }, { status: 400 });

    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (const s of students) {
      const { name, username, password, avatar } = s;
      if (!name || !username || !password) {
        results.errors.push(`${name || username}: 필수 항목 누락`);
        continue;
      }
      const exists = await prisma.student.findUnique({ where: { username } });
      if (exists) { results.skipped++; continue; }
      const passwordHash = await bcrypt.hash(String(password), 10);
      await prisma.student.create({ data: { name, username, passwordHash, avatar: avatar || "🐥" } });
      results.created++;
    }

    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: "오류가 발생했어요" }, { status: 500 });
  }
}
