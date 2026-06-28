import { NextRequest, NextResponse } from "next/server";
import { getStudentId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/progress?wordSetId=X
export async function GET(req: NextRequest) {
  const studentId = await getStudentId(req);
  if (!studentId) return NextResponse.json(null, { status: 401 });

  const wordSetId = Number(req.nextUrl.searchParams.get("wordSetId"));
  if (!wordSetId) return NextResponse.json(null, { status: 400 });

  const progress = await prisma.learningProgress.findUnique({
    where: { studentId_wordSetId: { studentId, wordSetId } },
  });

  return NextResponse.json(progress);
}

// POST /api/progress — upsert
export async function POST(req: NextRequest) {
  const studentId = await getStudentId(req);
  if (!studentId) return NextResponse.json(null, { status: 401 });

  const { wordSetId, batchIdx, wordOrder } = await req.json();

  const progress = await prisma.learningProgress.upsert({
    where: { studentId_wordSetId: { studentId, wordSetId } },
    create: { studentId, wordSetId, batchIdx, wordOrder: JSON.stringify(wordOrder) },
    update: { batchIdx, wordOrder: JSON.stringify(wordOrder) },
  });

  return NextResponse.json(progress);
}

// DELETE /api/progress?wordSetId=X — 완료 시 삭제
export async function DELETE(req: NextRequest) {
  const studentId = await getStudentId(req);
  if (!studentId) return NextResponse.json(null, { status: 401 });

  const wordSetId = Number(req.nextUrl.searchParams.get("wordSetId"));
  if (!wordSetId) return NextResponse.json(null, { status: 400 });

  await prisma.learningProgress.deleteMany({
    where: { studentId, wordSetId },
  });

  return NextResponse.json({ ok: true });
}
