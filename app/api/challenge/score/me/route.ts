import { NextResponse } from "next/server";
import { getStudentId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const studentId = await getStudentId(req);
  if (!studentId) return NextResponse.json({ isFirst: false }, { status: 401 });

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { placementDone: true },
  });
  return NextResponse.json({ isFirst: !student?.placementDone });
}
