import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/rankings  — 공개 API, 로그인 불필요
export async function GET() {
  try {
    // 학습량 Top3: 챌린지 참여 횟수 기준
    const volumeRaw = await prisma.challengeScore.groupBy({
      by: ["studentId"],
      _count: { id: true },
      _sum: { totalQuestions: true },
      orderBy: { _count: { id: "desc" } },
      take: 3,
    });

    // 점수 Top3: 총 점수 합계 기준
    const scoreRaw = await prisma.challengeScore.groupBy({
      by: ["studentId"],
      _sum: { score: true },
      orderBy: { _sum: { score: "desc" } },
      take: 3,
    });

    const allStudentIds = [
      ...new Set([...volumeRaw.map(r => r.studentId), ...scoreRaw.map(r => r.studentId)]),
    ];

    const students = await prisma.student.findMany({
      where: { id: { in: allStudentIds } },
      select: { id: true, name: true, avatar: true },
    });

    const studentMap = new Map(students.map(s => [s.id, s]));

    const volumeTop3 = volumeRaw.map((r, i) => ({
      rank: i + 1,
      student: studentMap.get(r.studentId),
      sessions: r._count.id,
      totalQuestions: r._sum.totalQuestions ?? 0,
    }));

    const scoreTop3 = scoreRaw.map((r, i) => ({
      rank: i + 1,
      student: studentMap.get(r.studentId),
      totalScore: r._sum.score ?? 0,
    }));

    return NextResponse.json({ volumeTop3, scoreTop3 });
  } catch {
    return NextResponse.json({ volumeTop3: [], scoreTop3: [] });
  }
}
