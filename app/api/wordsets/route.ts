import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeacherId, getStudentId } from "@/lib/auth";

// GET /api/wordsets  (학생도 조회 가능)
export async function GET(req: Request) {
  const sid = await getStudentId(req);
  const tid = await getTeacherId(req);
  if (!sid && !tid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const wordSets = await prisma.wordSet.findMany({
    orderBy: { order: "asc" },
    include: { _count: { select: { words: true } } },
  });
  return NextResponse.json(wordSets);
}

// POST /api/wordsets  (선생님만)
export async function POST(req: Request) {
  const tid = await getTeacherId(req);
  if (!tid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description, emoji } = await req.json();
  if (!name) return NextResponse.json({ error: "이름을 입력해주세요" }, { status: 400 });

  const maxOrder = await prisma.wordSet.aggregate({ _max: { order: true } });
  const order = (maxOrder._max.order ?? 0) + 1;

  const ws = await prisma.wordSet.create({ data: { name, description: description || "", emoji: emoji || "📚", order } });
  return NextResponse.json(ws, { status: 201 });
}
