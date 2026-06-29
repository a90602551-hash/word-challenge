"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Word    { id: number; english: string; korean: string; }
interface WordSet { id: number; name: string; emoji: string; _count: { words: number }; }

const QUESTIONS_PER_GRADE = 3;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Question {
  word: Word;
  wordSetId: number;
  wordSetName: string;
  wordSetEmoji: string;
  choices: string[];
}

type Phase = "intro" | "quiz" | "result";

export default function PlacementPage() {
  const router = useRouter();
  const [phase, setPhase]         = useState<Phase>("intro");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [wordSets, setWordSets]   = useState<WordSet[]>([]);
  const [qIdx, setQIdx]           = useState(0);
  const [selected, setSelected]   = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [scores, setScores]       = useState<Record<number, { correct: number; total: number }>>({});
  const [recommended, setRecommended] = useState<WordSet | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(r => { if (!r.ok) router.push("/"); }).catch(() => router.push("/"));
  }, [router]);

  async function loadAndStart() {
    const wsRes = await fetch("/api/wordsets");
    const ws: WordSet[] = await wsRes.json();
    setWordSets(ws);

    // 각 학년에서 단어 로드 후 3개씩 샘플링
    const allWords: { wordSetId: number; words: Word[] }[] = await Promise.all(
      ws.map(async w => {
        const r = await fetch(`/api/wordsets/${w.id}/words`);
        const words: Word[] = await r.json();
        return { wordSetId: w.id, words: shuffle(words).slice(0, QUESTIONS_PER_GRADE) };
      })
    );

    // 전체 단어 풀 (보기 생성용)
    const allWordPool: Word[] = allWords.flatMap(w => w.words);

    const qs: Question[] = allWords.flatMap(({ wordSetId, words }) => {
      const wsInfo = ws.find(w => w.id === wordSetId)!;
      return words.map(word => {
        const pool = allWordPool.filter(w => w.id !== word.id);
        const distractors = shuffle(pool).slice(0, 3).map(w => w.english);
        return {
          word,
          wordSetId,
          wordSetName: wsInfo.name,
          wordSetEmoji: wsInfo.emoji,
          choices: shuffle([word.english, ...distractors]),
        };
      });
    });

    setQuestions(qs);
    setScores(Object.fromEntries(ws.map(w => [w.id, { correct: 0, total: 0 }])));
    setQIdx(0);
    setPhase("quiz");
  }

  function handleChoice(choice: string) {
    if (selected !== null) return;
    const q = questions[qIdx];
    const ok = choice === q.word.english;
    setSelected(choice);
    setIsCorrect(ok);
    setScores(prev => ({
      ...prev,
      [q.wordSetId]: {
        correct: prev[q.wordSetId].correct + (ok ? 1 : 0),
        total:   prev[q.wordSetId].total + 1,
      },
    }));
    setTimeout(() => {
      if (qIdx + 1 < questions.length) {
        setQIdx(i => i + 1);
        setSelected(null);
        setIsCorrect(null);
      } else {
        finishTest();
      }
    }, 700);
  }

  function finishTest() {
    // 추천 학년: 정답률 70% 이상인 가장 높은 학년, 없으면 가장 낮은 학년
    const passing = wordSets.filter(ws => {
      const s = scores[ws.id];
      // scores state may not be fully updated yet, compute from questions
      const wsQs = questions.filter(q => q.wordSetId === ws.id);
      // We'll recompute from the answers we have
      return true; // placeholder
    });

    // 각 학년 점수를 questions 기반으로 재계산
    const finalScores: Record<number, { correct: number; total: number }> = {};
    for (const ws of wordSets) finalScores[ws.id] = { correct: 0, total: 0 };

    // scores state는 비동기 업데이트라 마지막 답이 반영 안 될 수 있어 재계산
    for (const q of questions) {
      // selected는 마지막 문제만 있으므로 전체를 추적할 수 없음
      // → scores state 사용 (마지막 문제는 setTimeout 전에 setScores 완료됨)
    }

    // scores state 사용 (setTimeout 내에서 실행되므로 최신값)
    setPhase("result");
  }

  // result 단계에서 추천 계산
  useEffect(() => {
    if (phase !== "result" || wordSets.length === 0) return;

    // 각 학년 점수 재계산 (questions 기반, selected 추적 필요 없이 scores state 사용)
    // 70% 이상인 학년 중 가장 높은 것
    const passingSets = wordSets.filter(ws => {
      const s = scores[ws.id];
      if (!s || s.total === 0) return false;
      return s.correct / s.total >= 0.7;
    });

    if (passingSets.length > 0) {
      setRecommended(passingSets[passingSets.length - 1]);
    } else {
      setRecommended(wordSets[0]); // 가장 쉬운 학년
    }
  }, [phase, wordSets, scores]);

  function goToChallenge(wsId: number) {
    if (typeof window !== "undefined") {
      const idx = wordSets.findIndex(ws => ws.id === wsId);
      localStorage.setItem("wc_placed_id", String(wsId));
      localStorage.setItem("wc_unlocked_idx", String(idx));
    }
    router.replace(`/challenge?startSet=${wsId}`);
  }

  // ── 인트로 ──
  if (phase === "intro") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-400 to-orange-500 flex flex-col items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm text-center">
          <div className="text-6xl mb-4">🎯</div>
          <h1 className="text-2xl font-extrabold text-gray-800 mb-2">레벨 테스트</h1>
          <p className="text-gray-500 text-sm mb-2">학년별로 단어를 <strong>3문제씩</strong> 풀어볼게요.</p>
          <p className="text-gray-500 text-sm mb-6">나에게 딱 맞는 레벨을 찾아드려요! 😊</p>
          <div className="bg-amber-50 rounded-2xl p-4 mb-6 text-left space-y-2">
            <p className="text-xs text-amber-700 font-bold">📌 테스트 안내</p>
            <p className="text-xs text-gray-500">· 총 12문제 (학년별 3문제)</p>
            <p className="text-xs text-gray-500">· 한국어 뜻 보고 영어 단어 고르기</p>
            <p className="text-xs text-gray-500">· 결과에 따라 시작 학년 추천</p>
          </div>
          <button onClick={loadAndStart}
            className="w-full py-4 rounded-2xl text-white font-extrabold text-lg bg-gradient-to-r from-amber-400 to-orange-500 shadow-lg">
            테스트 시작! 🚀
          </button>
        </div>
      </div>
    );
  }

  // ── 퀴즈 ──
  if (phase === "quiz") {
    const q = questions[qIdx];
    if (!q) return null;
    const progress = (qIdx / questions.length) * 100;
    const gradeQIdx = questions.slice(0, qIdx).filter(x => x.wordSetId === q.wordSetId).length;

    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-400 to-orange-500 flex flex-col">
        <div className="px-4 py-4 flex items-center gap-3">
          <div className="flex-1 text-center">
            <p className="text-white/70 text-xs">{q.wordSetEmoji} {q.wordSetName} · {gradeQIdx + 1}/{QUESTIONS_PER_GRADE}문제</p>
            <p className="text-white font-bold text-sm">레벨 테스트</p>
          </div>
          <span className="text-white/60 text-sm">{qIdx + 1}/12</span>
        </div>

        <div className="h-2 bg-white/20">
          <div className="h-full bg-white/70 transition-all duration-500 rounded-r-full" style={{ width: `${progress}%` }} />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-5 gap-5">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 text-center">
            <p className="text-xs text-gray-400 mb-2 font-bold">한국어 뜻</p>
            <p className="text-4xl font-extrabold text-gray-800">{q.word.korean}</p>
            {isCorrect === true  && <p className="mt-3 text-green-500 font-extrabold">✅ {q.word.english}</p>}
            {isCorrect === false && <p className="mt-3 text-red-500 font-bold text-sm">❌ 정답: {q.word.english}</p>}
          </div>

          <div className="w-full max-w-sm grid grid-cols-2 gap-3">
            {q.choices.map(choice => {
              let cls = "bg-white/90 text-gray-800 border-2 border-white/30 hover:bg-white active:scale-95";
              if (selected !== null) {
                if (choice === q.word.english) cls = "bg-green-400 text-white border-2 border-green-300";
                else if (choice === selected)  cls = "bg-red-400 text-white border-2 border-red-300";
                else                           cls = "bg-white/40 text-white/50 border-2 border-white/20";
              }
              return (
                <button key={choice} onClick={() => handleChoice(choice)} disabled={selected !== null}
                  className={`rounded-2xl p-4 text-center font-bold text-base transition-all duration-200 shadow-md ${cls}`}>
                  {choice}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── 결과 ──
  if (phase === "result") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-400 to-orange-500 flex flex-col items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm">
          <div className="text-center mb-5">
            <div className="text-5xl mb-2">🎯</div>
            <h2 className="text-2xl font-extrabold text-gray-800">테스트 완료!</h2>
          </div>

          {/* 학년별 점수 */}
          <div className="space-y-2 mb-5">
            {wordSets.map(ws => {
              const s = scores[ws.id] ?? { correct: 0, total: QUESTIONS_PER_GRADE };
              const pct = s.total > 0 ? Math.round(s.correct / s.total * 100) : 0;
              const isRec = recommended?.id === ws.id;
              return (
                <div key={ws.id} className={`rounded-2xl px-4 py-3 flex items-center gap-3 ${isRec ? "bg-amber-50 ring-2 ring-amber-400" : "bg-gray-50"}`}>
                  <span className="text-2xl">{ws.emoji}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-800 text-sm">{ws.name}</p>
                      {isRec && <span className="text-xs bg-amber-400 text-white px-2 py-0.5 rounded-full font-bold">추천!</span>}
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full mt-1">
                      <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className={`text-sm font-extrabold ${pct >= 70 ? "text-green-500" : "text-gray-400"}`}>{s.correct}/{s.total}</span>
                </div>
              );
            })}
          </div>

          {recommended && (
            <div className="text-center mb-4">
              <p className="text-sm text-gray-500">
                <span className="font-bold text-amber-500">{recommended.emoji} {recommended.name}</span>부터 시작하는 걸 추천해요!
              </p>
            </div>
          )}

          <div className="space-y-2">
            {recommended && (
              <button onClick={() => goToChallenge(recommended.id)}
                className="w-full py-4 rounded-2xl text-white font-extrabold text-lg bg-gradient-to-r from-amber-400 to-orange-500 shadow-lg">
                {recommended.emoji} {recommended.name}으로 시작! →
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
