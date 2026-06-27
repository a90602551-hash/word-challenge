import { NextResponse } from "next/server";
import { getTeacherId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const teacherId = await getTeacherId(req);
  if (!teacherId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const teacher = await prisma.teacher.findUnique({ where: { id: teacherId }, select: { id: true, name: true, isAdmin: true } });
  if (!teacher) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(teacher);
}
