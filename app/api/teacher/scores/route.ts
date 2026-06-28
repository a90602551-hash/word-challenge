import { NextResponse } from "next/server";
import { getTeacherId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const teacherId = await getTeacherId(req);
  if (!teacherId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [students, wordSets, scores, progresses] = await Promise.all([
    prisma.student.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, avatar: true, username: true } }),
    prisma.wordSet.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true, emoji: true, _count: { select: { words: true } } } }),
    prisma.challengeScore.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.learningProgress.findMany(),
  ]);

  return NextResponse.json({ students, wordSets, scores, progresses });
}
