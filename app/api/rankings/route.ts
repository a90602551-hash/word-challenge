import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStudentId } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const myId = await getStudentId(req).catch(() => null);

    const wordSets = await prisma.wordSet.findMany({
      orderBy: { order: "asc" },
      select: { id: true, name: true, emoji: true },
    });

    const allScores = await prisma.challengeScore.findMany({
      where: { totalQuestions: { gt: 0 } },
    });

    const results = wordSets.map(ws => {
      const wsScores = allScores.filter(sc => sc.wordSetId === ws.id);

      // 학습량: 학년별 도전 횟수 (전체 정렬)
      const sessionMap = new Map<number, number>();
      for (const sc of wsScores) {
        sessionMap.set(sc.studentId, (sessionMap.get(sc.studentId) ?? 0) + 1);
      }
      const volumeAllRaw = [...sessionMap.entries()].sort((a, b) => b[1] - a[1]);
      const volumeTop3Raw = volumeAllRaw.slice(0, 3);

      // 성적: 학년별 평균 정확도 (전체 정렬)
      const accSumMap = new Map<number, number>();
      const accCntMap = new Map<number, number>();
      for (const sc of wsScores) {
        const acc = sc.score / sc.totalQuestions;
        accSumMap.set(sc.studentId, (accSumMap.get(sc.studentId) ?? 0) + acc);
        accCntMap.set(sc.studentId, (accCntMap.get(sc.studentId) ?? 0) + 1);
      }
      const scoreAllRaw = [...accSumMap.entries()]
        .map(([id, sum]) => [id, sum / (accCntMap.get(id) ?? 1)] as [number, number])
        .sort((a, b) => b[1] - a[1]);
      const scoreTop3Raw = scoreAllRaw.slice(0, 3);

      // 내 순위 계산
      let myVolume: { rank: number; sessions: number; gapToAbove: number } | null = null;
      let myScore:  { rank: number; avgAccuracy: number; gapToAbove: number } | null = null;

      if (myId) {
        const myVolumeIdx = volumeAllRaw.findIndex(([id]) => id === myId);
        if (myVolumeIdx >= 0) {
          const myVal = volumeAllRaw[myVolumeIdx][1];
          const aboveVal = myVolumeIdx > 0 ? volumeAllRaw[myVolumeIdx - 1][1] : myVal;
          myVolume = { rank: myVolumeIdx + 1, sessions: myVal, gapToAbove: aboveVal - myVal };
        }

        const myScoreIdx = scoreAllRaw.findIndex(([id]) => id === myId);
        if (myScoreIdx >= 0) {
          const myVal = scoreAllRaw[myScoreIdx][1];
          const aboveVal = myScoreIdx > 0 ? scoreAllRaw[myScoreIdx - 1][1] : myVal;
          myScore = {
            rank: myScoreIdx + 1,
            avgAccuracy: Math.round(myVal * 100),
            gapToAbove: Math.round((aboveVal - myVal) * 100),
          };
        }
      }

      return { wordSetId: ws.id, name: ws.name, emoji: ws.emoji, volumeTop3Raw, scoreTop3Raw, myVolume, myScore };
    });

    // 필요한 studentId 모두 수집
    const allIds = new Set<number>();
    for (const r of results) {
      r.volumeTop3Raw.forEach(([id]) => allIds.add(id));
      r.scoreTop3Raw.forEach(([id]) => allIds.add(id));
    }

    const students = await prisma.student.findMany({
      where: { id: { in: [...allIds] } },
      select: { id: true, name: true, avatar: true },
    });
    const studentMap = new Map(students.map(s => [s.id, s]));

    const rankings = results.map(r => ({
      wordSetId: r.wordSetId,
      name: r.name,
      emoji: r.emoji,
      volumeTop3: r.volumeTop3Raw.map(([id, sessions], i) => ({
        rank: i + 1,
        student: studentMap.get(id),
        sessions,
      })),
      scoreTop3: r.scoreTop3Raw.map(([id, avg], i) => ({
        rank: i + 1,
        student: studentMap.get(id),
        avgAccuracy: Math.round(avg * 100),
      })),
      myVolume: r.myVolume,
      myScore: r.myScore,
    }));

    return NextResponse.json({ rankings });
  } catch {
    return NextResponse.json({ rankings: [] });
  }
}
