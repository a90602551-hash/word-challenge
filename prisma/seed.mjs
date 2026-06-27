import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const BUILT_IN_WORDS = [
  { english: "apple", korean: "사과" },
  { english: "banana", korean: "바나나" },
  { english: "orange", korean: "오렌지" },
  { english: "grape", korean: "포도" },
  { english: "strawberry", korean: "딸기" },
  { english: "watermelon", korean: "수박" },
  { english: "pineapple", korean: "파인애플" },
  { english: "peach", korean: "복숭아" },
  { english: "dog", korean: "강아지" },
  { english: "cat", korean: "고양이" },
  { english: "rabbit", korean: "토끼" },
  { english: "bear", korean: "곰" },
  { english: "elephant", korean: "코끼리" },
  { english: "lion", korean: "사자" },
  { english: "tiger", korean: "호랑이" },
  { english: "penguin", korean: "펭귄" },
  { english: "school", korean: "학교" },
  { english: "book", korean: "책" },
  { english: "pencil", korean: "연필" },
  { english: "eraser", korean: "지우개" },
  { english: "ruler", korean: "자" },
  { english: "desk", korean: "책상" },
  { english: "chair", korean: "의자" },
  { english: "teacher", korean: "선생님" },
  { english: "friend", korean: "친구" },
  { english: "red", korean: "빨간색" },
  { english: "blue", korean: "파란색" },
  { english: "green", korean: "초록색" },
  { english: "yellow", korean: "노란색" },
  { english: "white", korean: "흰색" },
  { english: "black", korean: "검은색" },
  { english: "pink", korean: "분홍색" },
  { english: "purple", korean: "보라색" },
  { english: "Monday", korean: "월요일" },
  { english: "Tuesday", korean: "화요일" },
  { english: "Wednesday", korean: "수요일" },
  { english: "Thursday", korean: "목요일" },
  { english: "Friday", korean: "금요일" },
  { english: "Saturday", korean: "토요일" },
  { english: "Sunday", korean: "일요일" },
  { english: "spring", korean: "봄" },
  { english: "summer", korean: "여름" },
  { english: "autumn", korean: "가을" },
  { english: "winter", korean: "겨울" },
  { english: "happy", korean: "행복한" },
  { english: "sad", korean: "슬픈" },
  { english: "hungry", korean: "배고픈" },
  { english: "tired", korean: "피곤한" },
  { english: "fast", korean: "빠른" },
  { english: "slow", korean: "느린" },
];

async function main() {
  // 관리자 교사 계정
  const hash = await bcrypt.hash("admin1234", 10);
  await prisma.teacher.upsert({
    where: { email: "admin@wordchallenge.com" },
    update: {},
    create: { name: "관리자", email: "admin@wordchallenge.com", passwordHash: hash, isAdmin: true },
  });

  // 기본 단어 세트 (과일, 동물, 학교, 색깔, 요일, 계절, 감정/형용사)
  const sets = [
    { name: "🍎 과일", words: BUILT_IN_WORDS.slice(0, 8) },
    { name: "🐶 동물", words: BUILT_IN_WORDS.slice(8, 16) },
    { name: "🏫 학교", words: BUILT_IN_WORDS.slice(16, 25) },
    { name: "🎨 색깔", words: BUILT_IN_WORDS.slice(25, 33) },
    { name: "📅 요일", words: BUILT_IN_WORDS.slice(33, 40) },
    { name: "🌸 계절", words: BUILT_IN_WORDS.slice(40, 44) },
    { name: "😊 감정/형용사", words: BUILT_IN_WORDS.slice(44) },
  ];

  for (let i = 0; i < sets.length; i++) {
    const { name, words } = sets[i];
    const existing = await prisma.wordSet.findFirst({ where: { name } });
    if (existing) continue;
    const ws = await prisma.wordSet.create({ data: { name, isBuiltIn: true, order: i + 1 } });
    for (let j = 0; j < words.length; j++) {
      await prisma.word.create({ data: { wordSetId: ws.id, english: words[j].english, korean: words[j].korean, order: j + 1 } });
    }
    console.log(`✅ WordSet 생성: ${name} (${words.length}개)`);
  }

  console.log("🌱 시드 완료!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
