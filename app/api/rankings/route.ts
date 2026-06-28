import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // 학습량 Top3: 도전 횟수 많은 순
    const volumeRaw = await prisma.challengeScore.groupBy({
      by: ["studentId"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 3,
    });

    // 성적: 모든 점수 가져와서 학생별 최고 정확도 계산
    const allScores = await prisma.challengeScore.findMany({
      where: { totalQuestions: { gt: 0 } },
    });

    // 학생별 최고 정확도 계산
    const bestAccMap = new Map<number, number>();
    for (const sc of allScores) {
      const acc = sc.score / sc.totalQuestions;
      const prev = bestAccMap.get(sc.studentId) ?? 0;
      if (acc > prev) bestAccMap.set(sc.studentId, acc);
    }

    // 정확도 Top3
    const scoreTop3Raw = [...bestAccMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const allStudentIds = [
      ...new Set([...volumeRaw.map(r => r.studentId), ...scoreTop3Raw.map(([id]) => id)]),
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
    }));

    const scoreTop3 = scoreTop3Raw.map(([studentId, acc], i) => ({
      rank: i + 1,
      student: studentMap.get(studentId),
      bestAccuracy: Math.round(acc * 100),
    }));

    return NextResponse.json({ volumeTop3, scoreTop3 });
  } catch {
    return NextResponse.json({ volumeTop3: [], scoreTop3: [] });
  }
}
