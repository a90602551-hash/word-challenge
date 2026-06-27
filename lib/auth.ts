import { SignJWT, jwtVerify } from "jose";

const TEACHER_SECRET = new TextEncoder().encode(
  process.env.TEACHER_JWT_SECRET || "teacher-secret-change-in-prod"
);
const STUDENT_SECRET = new TextEncoder().encode(
  process.env.STUDENT_JWT_SECRET || "student-secret-change-in-prod"
);

export const TEACHER_COOKIE = "wc_teacher";
export const STUDENT_COOKIE = "wc_student";

export async function signTeacherToken(teacherId: number) {
  return new SignJWT({ sub: String(teacherId), role: "teacher" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("12h")
    .sign(TEACHER_SECRET);
}

export async function signStudentToken(studentId: number) {
  return new SignJWT({ sub: String(studentId), role: "student" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(STUDENT_SECRET);
}

export async function verifyTeacherToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, TEACHER_SECRET);
    return payload;
  } catch {
    return null;
  }
}

export async function verifyStudentToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, STUDENT_SECRET);
    return payload;
  } catch {
    return null;
  }
}

export async function getStudentId(req: Request): Promise<number | null> {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(/wc_student=([^;]+)/);
  const token = match?.[1];
  if (!token) return null;
  const payload = await verifyStudentToken(token);
  if (!payload?.sub) return null;
  return Number(payload.sub);
}

export async function getTeacherId(req: Request): Promise<number | null> {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(/wc_teacher=([^;]+)/);
  const token = match?.[1];
  if (!token) return null;
  const payload = await verifyTeacherToken(token);
  if (!payload?.sub) return null;
  return Number(payload.sub);
}
