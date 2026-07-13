import { NextResponse } from "next/server";
import { getStudentId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const studentId = await getStudentId(req);
  if (!studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, name: true, avatar: true, currentWordSetId: true } });
  if (!student) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(student);
}

export async function PATCH(req: Request) {
  const studentId = await getStudentId(req);
  if (!studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { currentWordSetId } = await req.json();
  await prisma.student.update({ where: { id: studentId }, data: { currentWordSetId: currentWordSetId ?? null } });
  return NextResponse.json({ ok: true });
}
