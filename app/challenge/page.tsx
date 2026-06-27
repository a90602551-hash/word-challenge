"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface WordSet { id: number; name: string; emoji: string; _count: { words: number }; }
interface Word    { id: number; english: string; korean: string; }

type Mode = "MEANING_TO_WORD" | "WORD_TO_MEANING" | "TYPING";
type Screen = "select-set" | "select-mode" | "playing" | "result";

const MODE_INFO: Record<Mode, { label: string; desc: string; emoji: string; color: string }> = {
  MEANING_TO_WORD: { label: "뜻 → 단어 고르기",   desc: "한국어 뜻을 보고 영어 단어를 선택해요", emoji: "🇰🇷→🇺🇸", color: "#6366f1" },
  WORD_TO_MEANING: { label: "단어 → 뜻 고르기",   desc: "영어 단어를 보고 한국어 뜻을 선택해요",  emoji: "🇺🇸→🇰🇷", color: "#0ea5e9" },
  TYPING:          { label: "단어 직접 타이핑하기", desc: "한국어 뜻을 보고 영어를 직접 입력해요",  emoji: "⌨️",       color: "#10b981" },
};

const TOTAL_QUESTIONS = 10;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getChoices(correct: Word, allWords: Word[], isTyping = false): string[] {
  if (isTyping) return [];
  const others = shuffle(allWords.filter(w => w.id !== correct.id)).slice(0, 3);
  return shuffle([correct, ...others]).map(w => w.english);
}

function getMeaningChoices(correct: Word, allWords: Word[]): string[] {
  const others = shuffle(allWords.filter(w => w.id !== correct.id)).slice(0, 3);
  return shuffle([correct, ...others]).map(w => w.korean);
}

export default function ChallengePage() {
  const router = useRouter();
  const [screen, setScreen]     = useState<Screen>("select-set");
  const [wordSets, setWordSets] = useState<WordSet[]>([]);
  const [selectedSet, setSelectedSet] = useState<WordSet | null>(null);
  const [selectedMode, setSelectedMode] = useState<Mode | null>(null);
  const [words, setWords]       = useState<Word[]>([]);
  const [questions, setQuestions] = useState<Word[]>([]);
  const [qIdx, setQIdx]         = useState(0);
  const [choices, setChoices]   = useState<string[]>([]);
  const [typed, setTyped]       = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore]       = useState(0);
  const [animKey, setAnimKey]   = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // 로그인 체크
  useEffect(() => {
    fetch("/api/auth/me").then(r => { if (!r.ok) router.push("/"); }).catch(() => router.push("/"));
  }, [router]);

  // 단어 세트 불러오기
  useEffect(() => {
    fetch("/api/wordsets").then(r => r.json()).then(setWordSets).catch(() => {});
  }, []);

  const startGame = useCallback(async (ws: WordSet, mode: Mode) => {
    const res = await fetch(`/api/wordsets/${ws.id}/words`);
    const allWords: Word[] = await res.json();
    if (allWords.length < 4) { alert("단어가 최소 4개 이상 필요해요!"); return; }
    setWords(allWords);
    const qs = shuffle(allWords).slice(0, Math.min(TOTAL_QUESTIONS, allWords.length));
    setQuestions(qs);
    setQIdx(0);
    setScore(0);
    setSelected(null);
    setIsCorrect(null);
    setTyped("");
    buildChoices(qs[0], allWords, mode);
    setScreen("playing");
    setAnimKey(k => k + 1);
  }, []);

  function buildChoices(q: Word, allWords: Word[], mode: Mode) {
    if (mode === "MEANING_TO_WORD") {
      setChoices(getChoices(q, allWords));
    } else if (mode === "WORD_TO_MEANING") {
      setChoices(getMeaningChoices(q, allWords));
    } else {
      setChoices([]);
    }
  }

  function handleChoice(choice: string) {
    if (selected !== null) return;
    const q = questions[qIdx];
    const correct = selectedMode === "MEANING_TO_WORD" ? q.english : q.korean;
    const ok = choice === correct;
    setSelected(choice);
    setIsCorrect(ok);
    if (ok) setScore(s => s + 1);
    setTimeout(() => nextQuestion(), 900);
  }

  function handleTypingSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isCorrect !== null) return;
    const q = questions[qIdx];
    const ok = typed.trim().toLowerCase() === q.english.toLowerCase();
    setIsCorrect(ok);
    if (ok) setScore(s => s + 1);
    setTimeout(() => { nextQuestion(); setTyped(""); }, 900);
  }

  function nextQuestion() {
    const next = qIdx + 1;
    if (next >= questions.length) {
      finishGame();
    } else {
      setQIdx(next);
      setSelected(null);
      setIsCorrect(null);
      setTyped("");
      buildChoices(questions[next], words, selectedMode!);
      setAnimKey(k => k + 1);
    }
  }

  async function finishGame() {
    const finalScore = score; // score may not update yet; we'll compute separately
    setScreen("result");
    try {
      await fetch("/api/challenge/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, totalQuestions: questions.length, mode: selectedMode, wordSetId: selectedSet?.id }),
      });
    } catch {}
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  const q = questions[qIdx];
  const progress = questions.length > 0 ? ((qIdx) / questions.length) * 100 : 0;
  const modeInfo = selectedMode ? MODE_INFO[selectedMode] : null;

  // ── 단어 세트 선택 ──
  if (screen === "select-set") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 px-4 py-8">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-extrabold text-white">📚 단어장 선택</h1>
            <button onClick={handleLogout} className="text-white/60 hover:text-white text-sm">로그아웃</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {wordSets.map(ws => (
              <button key={ws.id} onClick={() => { setSelectedSet(ws); setScreen("select-mode"); }}
                className="bg-white rounded-2xl p-4 text-left shadow-lg hover:scale-105 active:scale-95 transition-transform">
                <p className="text-3xl mb-2">{ws.emoji || "📚"}</p>
                <p className="font-extrabold text-gray-800">{ws.name}</p>
                <p className="text-xs text-gray-400 mt-1">{ws._count.words}개 단어</p>
              </button>
            ))}
            {wordSets.length === 0 && (
              <div className="col-span-2 bg-white/20 rounded-2xl p-8 text-center text-white">
                <p className="text-4xl mb-3">📭</p>
                <p className="font-bold">아직 단어장이 없어요</p>
                <p className="text-sm text-white/70 mt-1">선생님이 단어를 추가해주실 거예요!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── 모드 선택 ──
  if (screen === "select-mode") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 px-4 py-8">
        <div className="max-w-lg mx-auto">
          <button onClick={() => setScreen("select-set")} className="text-white/70 hover:text-white mb-4 text-sm">← 단어장 선택</button>
          <h1 className="text-2xl font-extrabold text-white mb-2">🎮 학습 방법 선택</h1>
          <p className="text-purple-200 text-sm mb-5">📚 {selectedSet?.name} · {selectedSet?._count.words}개 단어</p>
          <div className="space-y-3">
            {(Object.entries(MODE_INFO) as [Mode, typeof MODE_INFO[Mode]][]).map(([mode, info]) => (
              <button key={mode} onClick={() => { setSelectedMode(mode); startGame(selectedSet!, mode); }}
                className="w-full bg-white rounded-2xl p-5 text-left shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0"
                  style={{ background: `${info.color}22` }}>
                  {info.emoji}
                </div>
                <div>
                  <p className="font-extrabold text-gray-800 text-base">{info.label}</p>
                  <p className="text-sm text-gray-400 mt-0.5">{info.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── 게임 ──
  if (screen === "playing" && q) {
    const color = modeInfo?.color || "#6366f1";
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* 상단 바 */}
        <div className="bg-white px-4 py-3 shadow-sm flex items-center gap-3">
          <button onClick={() => setScreen("select-mode")} className="text-gray-400 hover:text-gray-700 text-sm">✕</button>
          <div className="flex-1">
            <p className="text-xs text-gray-400">{modeInfo?.emoji} {modeInfo?.label} · {selectedSet?.name}</p>
          </div>
          <span className="text-sm font-bold" style={{ color }}>{qIdx + 1} / {questions.length}</span>
        </div>
        {/* 진행 바 */}
        <div className="h-2 bg-gray-200">
          <div className="h-full transition-all duration-500 rounded-r-full" style={{ width: `${progress}%`, background: color }} />
        </div>
        {/* 점수 */}
        <div className="flex justify-center pt-3">
          <div className="bg-white rounded-full px-5 py-1.5 shadow text-sm font-bold" style={{ color }}>
            ⭐ {score}점
          </div>
        </div>

        <div className="flex-1 max-w-lg mx-auto w-full px-4 py-4 flex flex-col gap-4">
          {/* 문제 카드 */}
          <div key={animKey} className="bounce-in bg-white rounded-3xl shadow-md p-6 text-center">
            {selectedMode === "MEANING_TO_WORD" && (
              <>
                <p className="text-xs text-gray-400 mb-2">이 뜻의 영어 단어는?</p>
                <p className="text-4xl font-extrabold text-gray-800">{q.korean}</p>
              </>
            )}
            {selectedMode === "WORD_TO_MEANING" && (
              <>
                <p className="text-xs text-gray-400 mb-2">이 단어의 뜻은?</p>
                <p className="text-4xl font-extrabold text-gray-800">{q.english}</p>
              </>
            )}
            {selectedMode === "TYPING" && (
              <>
                <p className="text-xs text-gray-400 mb-2">이 뜻의 영어 단어를 입력해요</p>
                <p className="text-4xl font-extrabold text-gray-800">{q.korean}</p>
              </>
            )}
            {isCorrect === true  && <p className="mt-3 text-green-500 font-extrabold text-lg animate-bounce">✅ 정답! 🎉</p>}
            {isCorrect === false && <p className="mt-3 text-red-500 font-extrabold text-base">❌ 정답: {q.english}</p>}
          </div>

          {/* 선택지 (객관식 모드) */}
          {selectedMode !== "TYPING" && (
            <div className="grid grid-cols-2 gap-3">
              {choices.map((choice) => {
                const isSelected = selected === choice;
                const correctAnswer = selectedMode === "MEANING_TO_WORD" ? q.english : q.korean;
                const isTheCorrect = choice === correctAnswer;
                let bg = "bg-white border-2 border-gray-200 text-gray-800";
                if (selected !== null) {
                  if (isTheCorrect) bg = "bg-green-100 border-2 border-green-400 text-green-800";
                  else if (isSelected && !isTheCorrect) bg = "bg-red-100 border-2 border-red-400 text-red-700";
                  else bg = "bg-white border-2 border-gray-100 text-gray-400";
                }
                return (
                  <button key={choice} onClick={() => handleChoice(choice)} disabled={selected !== null}
                    className={`rounded-2xl p-4 text-center font-bold text-base shadow-sm transition-all active:scale-95 ${bg}`}>
                    {choice}
                  </button>
                );
              })}
            </div>
          )}

          {/* 타이핑 모드 */}
          {selectedMode === "TYPING" && (
            <form onSubmit={handleTypingSubmit} className="space-y-3">
              <input ref={inputRef} type="text" value={typed}
                onChange={e => { setTyped(e.target.value); setIsCorrect(null); }}
                disabled={isCorrect !== null}
                placeholder="영어로 입력하세요..."
                autoComplete="off" autoCorrect="off" spellCheck={false}
                className={`w-full border-2 rounded-2xl px-5 py-4 text-xl text-center font-bold outline-none transition-all
                  ${isCorrect === true ? "border-green-400 bg-green-50" : isCorrect === false ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-purple-400"}`}
              />
              <button type="submit" disabled={!typed || isCorrect !== null}
                className="w-full py-4 rounded-2xl text-white font-extrabold text-lg shadow-lg transition-all disabled:opacity-40"
                style={{ background: color }}>
                확인하기 ✓
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ── 결과 ──
  if (screen === "result") {
    const total = questions.length;
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    const emoji = pct === 100 ? "🏆" : pct >= 80 ? "🎉" : pct >= 60 ? "😊" : pct >= 40 ? "😅" : "💪";
    const msg   = pct === 100 ? "완벽해요!" : pct >= 80 ? "잘했어요!" : pct >= 60 ? "좋아요!" : pct >= 40 ? "조금 더 연습해요" : "다시 도전해봐요!";
    const color = modeInfo?.color || "#6366f1";

    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 flex flex-col items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm text-center bounce-in">
          <div className="text-7xl mb-3">{emoji}</div>
          <h2 className="text-3xl font-extrabold text-gray-800 mb-1">{msg}</h2>
          <p className="text-gray-400 text-sm mb-6">{selectedSet?.name} · {modeInfo?.label}</p>

          <div className="flex justify-center gap-4 mb-6">
            <div className="bg-purple-50 rounded-2xl px-6 py-4">
              <p className="text-4xl font-extrabold" style={{ color }}>{score}<span className="text-2xl">/{total}</span></p>
              <p className="text-xs text-gray-400 mt-1">정답 수</p>
            </div>
            <div className="bg-yellow-50 rounded-2xl px-6 py-4">
              <p className="text-4xl font-extrabold text-yellow-500">{pct}%</p>
              <p className="text-xs text-gray-400 mt-1">정확도</p>
            </div>
          </div>

          {/* 진행 바 */}
          <div className="h-3 bg-gray-100 rounded-full mb-6">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
          </div>

          <div className="space-y-3">
            <button onClick={() => startGame(selectedSet!, selectedMode!)}
              className="w-full py-4 rounded-2xl text-white font-extrabold text-lg shadow-lg"
              style={{ background: color }}>
              🔄 다시 도전!
            </button>
            <button onClick={() => setScreen("select-mode")}
              className="w-full py-3 rounded-2xl border-2 font-bold text-gray-600" style={{ borderColor: color }}>
              다른 방법으로 하기
            </button>
            <button onClick={() => setScreen("select-set")}
              className="w-full py-3 rounded-2xl text-gray-400 text-sm font-medium">
              단어장 바꾸기
            </button>
          </div>
        </div>

        <button onClick={() => router.push("/")} className="mt-6 text-white/60 hover:text-white text-sm">
          홈으로 →
        </button>
      </div>
    );
  }

  return null;
}
