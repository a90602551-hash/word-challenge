import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeacherId, getStudentId } from "@/lib/auth";

// GET /api/wordsets/[id]/words
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sid = await getStudentId(req);
  const tid = await getTeacherId(req);
  if (!sid && !tid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const words = await prisma.word.findMany({
    where: { wordSetId: Number(id) },
    orderBy: { order: "asc" },
  });
  return NextResponse.json(words);
}

// POST /api/wordsets/[id]/words  { english, korean }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const tid = await getTeacherId(req);
  if (!tid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { english, korean } = await req.json();
  if (!english || !korean) return NextResponse.json({ error: "영어와 한국어를 입력해주세요" }, { status: 400 });

  const maxOrder = await prisma.word.aggregate({ _max: { order: true }, where: { wordSetId: Number(id) } });
  const order = (maxOrder._max.order ?? 0) + 1;

  const word = await prisma.word.create({ data: { wordSetId: Number(id), english, korean, order } });
  return NextResponse.json(word, { status: 201 });
}
