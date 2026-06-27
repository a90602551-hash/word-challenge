import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeacherId } from "@/lib/auth";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const tid = await getTeacherId(req);
  if (!tid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.wordSet.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
