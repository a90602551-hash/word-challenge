import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getTeacherId } from "@/lib/auth";

// DELETE /api/students/[id]
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const tid = await getTeacherId(req);
  if (!tid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.student.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}

// PATCH /api/students/[id]  { password?, approved? }
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const tid = await getTeacherId(req);
  if (!tid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  if (typeof body.approved === "boolean") {
    await prisma.student.update({ where: { id: Number(id) }, data: { approved: body.approved } });
    return NextResponse.json({ ok: true });
  }

  if (body.extendDays) {
    const student = await prisma.student.findUnique({ where: { id: Number(id) } });
    if (!student) return NextResponse.json({ error: "학생 없음" }, { status: 404 });
    const base = student.expiresAt && student.expiresAt > new Date() ? student.expiresAt : new Date();
    const expiresAt = new Date(base.getTime() + Number(body.extendDays) * 24 * 60 * 60 * 1000);
    await prisma.student.update({ where: { id: Number(id) }, data: { expiresAt } });
    return NextResponse.json({ ok: true });
  }

  const { password } = body;
  if (!password) return NextResponse.json({ error: "비밀번호를 입력해주세요" }, { status: 400 });
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.student.update({ where: { id: Number(id) }, data: { passwordHash } });
  return NextResponse.json({ ok: true });
}
