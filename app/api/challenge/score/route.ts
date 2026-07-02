import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStudentId } from "@/lib/auth";

// POST /api/challenge/score  { score, totalQuestions, mode, wordSetId? }
export async function POST(req: Request) {
  const studentId = await getStudentId(req);
  if (!studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { score, totalQuestions, mode, wordSetId } = await req.json();
    const [record] = await Promise.all([
      prisma.challengeScore.create({
        data: { studentId, score: Number(score), totalQuestions: Number(totalQuestions), mode, wordSetId: wordSetId ? Number(wordSetId) : null },
      }),
      mode === "PLACEMENT"
        ? prisma.student.update({ where: { id: studentId }, data: { placementDone: true } })
        : Promise.resolve(),
    ]);
    return NextResponse.json(record, { status: 201 });
  } catch {
    return NextResponse.json({ error: "오류가 발생했어요" }, { status: 500 });
  }
}
