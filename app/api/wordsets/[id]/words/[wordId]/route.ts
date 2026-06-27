import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeacherId } from "@/lib/auth";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; wordId: string }> }) {
  const tid = await getTeacherId(req);
  if (!tid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { wordId } = await params;
  await prisma.word.delete({ where: { id: Number(wordId) } });
  return NextResponse.json({ ok: true });
}
