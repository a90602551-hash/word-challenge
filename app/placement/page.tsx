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

    const allWords: { wordSetId: number; words: Word[] }[] = await Promise.all(
      ws.map(async w => {
        const r = await fetch(`/api/wordsets/${w.id}/words`);
        const words: Word[] = await r.json();
        return { wordSetId: w.id, words: shuffle(words).slice(0, QUESTIONS_PER_GRADE) };
      })
    );

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
    const isPass = choice === "__pass__";
    const ok = !isPass && choice === q.word.english;
    setSelected(isPass ? "" : choice);
    setIsCorrect(isPass ? false : ok);
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
        setPhase("result");
      }
    }, isPass ? 100 : 700);
  }

  useEffect(() => {
    if (phase !== "result" || wordSets.length === 0) return;
    const passingSets = wordSets.filter(ws => {
      const s = scores[ws.id];
      if (!s || s.total === 0) return false;
      return s.correct / s.total >= 0.7;
    });
    if (passingSets.length > 0) {
      setRecommended(passingSets[passingSets.length - 1]);
    } else {
      setRecommended(wordSets[0]);
    }
  }, [phase, wordSets, scores]);

  async function goToChallenge(wsId: number) {
    if (typeof window !== "undefined") {
      const idx = wordSets.findIndex(ws => ws.id === wsId);
      localStorage.setItem("wc_placed_id", String(wsId));
      localStorage.setItem("wc_unlocked_idx", String(idx));
    }
    // 배치테스트 완료 기록 저장 → isFirst=false 처리
    await fetch("/api/challenge/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: 0, totalQuestions: 0, mode: "PLACEMENT", wordSetId: wsId }),
    }).catch(() => {});
    router.replace(`/challenge?startSet=${wsId}`);
  }

  const GradeCard = ({ ws, isRec }: { ws: WordSet; isRec: boolean }) => {
    const s = scores[ws.id] ?? { correct: 0, total: QUESTIONS_PER_GRADE };
    const pct = s.total > 0 ? Math.round(s.correct / s.total * 100) : 0;
    const gradeNum = ws.name.replace("학년", "");
    return (
      <div style={{
        position: "relative", background: "#fff",
        border: isRec ? "2px solid #F6E27F" : "1.5px solid #F0E8C8",
        borderRadius: "14px", padding: "12px 14px",
        display: "flex", alignItems: "center", gap: "12px", overflow: "hidden",
      }}>
        <img src="/TheFluent/logo.symbol.clear.png" alt="" style={{
          position: "absolute", width: "52px", height: "52px",
          objectFit: "contain", bottom: "-6px", right: "-4px",
          opacity: isRec ? 0.5 : 0.25,
        }} />
        <div style={{ position: "relative", zIndex: 1, textAlign: "center", minWidth: "30px" }}>
          <div style={{ fontSize: "18px", fontWeight: 900, color: isRec ? "#1F2A44" : "#CCCCCC", lineHeight: 1 }}>{gradeNum}</div>
          <div style={{ fontSize: "9px", color: isRec ? "#8A96A8" : "#DDDDDD" }}>학년</div>
        </div>
        <div style={{ flex: 1, position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "5px" }}>
            <span style={{ fontSize: "12px", fontWeight: 800, color: isRec ? "#1F2A44" : "#AAAAAA" }}>{ws.name}</span>
            {isRec && <span style={{ fontSize: "9px", background: "#F6E27F", color: "#1F2A44", borderRadius: "999px", padding: "1px 7px", fontWeight: 800 }}>추천!</span>}
          </div>
          <div style={{ height: "5px", background: "#F0ECE0", borderRadius: "999px", overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: pct >= 70 ? "#76C043" : "#F6E27F", borderRadius: "999px" }} />
          </div>
        </div>
        <span style={{ fontSize: "12px", fontWeight: 900, color: pct >= 70 ? "#76C043" : "#AAAAAA", position: "relative", zIndex: 1 }}>
          {s.correct}/{s.total}
        </span>
      </div>
    );
  };

  // ── 인트로 ──
  if (phase === "intro") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "#FFF9E6" }}>
        <div className="w-full max-w-sm text-center" style={{ background: "#fff", borderRadius: "24px", border: "1.5px solid #F0E8C8", padding: "32px 28px", boxShadow: "0 2px 16px rgba(246,226,127,0.2)" }}>
          <img src="/TheFluent/logo.clear.png" alt="The Fluent" style={{ height: "130px", objectFit: "contain", margin: "0 auto 24px", display: "block" }} />
          <div className="text-5xl mb-3">🎯</div>
          <h1 className="text-2xl font-black mb-2" style={{ color: "#1F2A44" }}>레벨 테스트</h1>
          <p className="text-sm mb-6" style={{ color: "#8A96A8", lineHeight: 1.7 }}>나에게 딱 맞는 학년을<br />찾아드릴게요! 😊</p>
          <div className="text-left mb-6" style={{ background: "#FFFBEE", border: "1.5px solid #F0E8C8", borderRadius: "14px", padding: "14px" }}>
            <p className="text-xs font-black mb-2" style={{ color: "#1F2A44" }}>📌 테스트 안내</p>
            <p className="text-xs" style={{ color: "#8A96A8", lineHeight: 1.9 }}>· 총 12문제 (학년별 3문제)<br />· 한국어 뜻 보고 영어 단어 고르기<br />· 결과에 따라 시작 학년 추천</p>
          </div>
          <button onClick={loadAndStart}
            className="w-full py-4 font-black text-lg rounded-2xl transition-all active:scale-95"
            style={{ background: "#1F2A44", color: "#F6E27F" }}>
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
    const progress = Math.round((qIdx / questions.length) * 100);
    const gradeQIdx = questions.slice(0, qIdx).filter(x => x.wordSetId === q.wordSetId).length;

    return (
      <div className="min-h-screen flex flex-col" style={{ background: "#FFF9E6" }}>
        {/* 남색 헤더 */}
        <div style={{ background: "#1F2A44", padding: "16px 20px" }}>
          <div style={{ textAlign: "center", marginBottom: "10px" }}>
            <div style={{ fontSize: "13px", fontWeight: 900, color: "#F6E27F" }}>🔍 최고의 시작 레벨을 찾는 중이에요!</div>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", marginTop: "3px" }}>{q.wordSetEmoji} {q.wordSetName} · {gradeQIdx + 1}/{QUESTIONS_PER_GRADE}문제 · 전체 {qIdx + 1}/{questions.length}</div>
          </div>
          <div style={{ height: "6px", background: "rgba(255,255,255,0.15)", borderRadius: "999px", overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "#F6E27F", borderRadius: "999px", transition: "width 0.5s" }} />
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-5 gap-5">
          {/* 단어 카드 */}
          <div className="w-full max-w-sm text-center" style={{ background: "#fff", border: "1.5px solid #F0E8C8", borderRadius: "20px", padding: "32px 24px" }}>
            <p className="text-xs font-black mb-3 uppercase tracking-wide" style={{ color: "#AAAAAA" }}>한국어 뜻</p>
            <p className="text-4xl font-black" style={{ color: "#1F2A44" }}>{q.word.korean}</p>
            {isCorrect === true  && <p className="mt-3 font-black" style={{ color: "#76C043" }}>✅ {q.word.english}</p>}
            {isCorrect === false && <p className="mt-3 text-sm font-bold" style={{ color: "#E8463A" }}>❌ 정답: {q.word.english}</p>}
          </div>

          {/* 보기 버튼 */}
          <div className="w-full max-w-sm grid grid-cols-2 gap-3">
            {q.choices.map(choice => {
              let bg = "#1F2A44";
              let border = "1.5px solid #2E3D5A";
              let color = "rgba(255,255,255,0.6)";
              if (selected !== null) {
                if (choice === q.word.english)   { bg = "#76C043"; border = "none"; color = "#fff"; }
                else if (choice === selected)     { bg = "#E8463A"; border = "none"; color = "#fff"; }
                else                              { bg = "rgba(31,42,68,0.4)"; color = "rgba(255,255,255,0.3)"; }
              }
              return (
                <button key={choice} onClick={() => handleChoice(choice)} disabled={selected !== null}
                  className="rounded-2xl p-4 text-center font-bold text-sm transition-all duration-200 active:scale-95"
                  style={{ background: bg, border, color }}>
                  {choice}
                </button>
              );
            })}
          </div>

          {/* 패스 버튼 */}
          {selected === null && (
            <button onClick={() => handleChoice("__pass__")}
              className="w-full max-w-sm py-3 rounded-2xl font-bold text-sm transition-all active:scale-95"
              style={{ background: "transparent", border: "1.5px solid #D8D0B8", color: "#AAAAAA" }}>
              🤷 모르겠어요 패스!
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── 결과 ──
  if (phase === "result") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "#FFF9E6" }}>
        <div className="w-full max-w-sm" style={{ background: "#fff", borderRadius: "24px", border: "1.5px solid #F0E8C8", padding: "28px", boxShadow: "0 2px 16px rgba(246,226,127,0.2)" }}>
          <div className="text-center mb-5">
            <div className="text-5xl mb-2">🎉</div>
            <h2 className="text-2xl font-black" style={{ color: "#1F2A44" }}>테스트 완료!</h2>
            {recommended && (
              <p className="text-sm mt-1" style={{ color: "#8A96A8" }}>
                <span style={{ color: "#1F2A44", fontWeight: 800 }}>{recommended.name}</span>부터 시작하는 걸 추천해요!
              </p>
            )}
          </div>

          <div className="space-y-2 mb-5">
            {wordSets.map(ws => (
              <GradeCard key={ws.id} ws={ws} isRec={recommended?.id === ws.id} />
            ))}
          </div>

          {recommended && (
            <button onClick={() => goToChallenge(recommended.id)}
              className="w-full py-4 font-black text-lg rounded-2xl transition-all active:scale-95"
              style={{ background: "#1F2A44", color: "#F6E27F" }}>
              {recommended.name}으로 시작! →
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
