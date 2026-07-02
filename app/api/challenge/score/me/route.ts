import { NextResponse } from "next/server";
import { getStudentId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const studentId = await getStudentId(req);
  if (!studentId) return NextResponse.json({ isFirst: false }, { status: 401 });

  const [scoreCount, progressCount] = await Promise.all([
    prisma.challengeScore.count({ where: { studentId } }),
    prisma.learningProgress.count({ where: { studentId } }),
  ]);
  return NextResponse.json({ isFirst: scoreCount === 0 && progressCount === 0 });
}
