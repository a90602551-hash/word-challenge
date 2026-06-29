import { NextResponse } from "next/server";
import { getStudentId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const studentId = await getStudentId(req);
  if (!studentId) return NextResponse.json({ isFirst: false }, { status: 401 });

  const count = await prisma.challengeScore.count({ where: { studentId } });
  return NextResponse.json({ isFirst: count === 0 });
}
