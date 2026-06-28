"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface WordSet { id: number; name: string; emoji: string; description: string; _count: { words: number }; }
interface Word    { id: number; english: string; korean: string; }

type Screen = "select-set" | "study" | "quiz-mtw" | "quiz-wtm" | "quiz-typing" | "batch-result" | "all-done";

const BATCH_SIZE = 5;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getChoices(correct: Word, allWords: Word[], type: "english" | "korean"): string[] {
  const pool = allWords.filter(w => w.id !== correct.id);
  const distractors = shuffle(pool).slice(0, 3).map(w => type === "english" ? w.english : w.korean);
  return shuffle([type === "english" ? correct.english : correct.korean, ...distractors]);
}

export default function ChallengePage() {
  const router = useRouter();
  const [wordSets, setWordSets]     = useState<WordSet[]>([]);
  const [allWords, setAllWords]     = useState<Word[]>([]);
  const [batches, setBatches]       = useState<Word[][]>([]);
  const [selectedSet, setSelectedSet] = useState<WordSet | null>(null);
  const [screen, setScreen]         = useState<Screen>("select-set");
  const [batchIdx, setBatchIdx]     = useState(0);
  const [quizIdx, setQuizIdx]       = useState(0);
  const [choices, setChoices]       = useState<string[]>([]);
  const [selected, setSelected]     = useState<string | null>(null);
  const [isCorrect, setIsCorrect]   = useState<boolean | null>(null);
  const [typed, setTyped]           = useState("");
  const [totalScore, setTotalScore] = useState(0);
  const [batchScore, setBatchScore] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [animKey, setAnimKey]       = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(r => { if (!r.ok) router.push("/"); }).catch(() => router.push("/"));
    fetch("/api/wordsets").then(r => r.json()).then(setWordSets).catch(() => {});
  }, [router]);

  useEffect(() => {
    if (screen === "quiz-typing") inputRef.current?.focus();
  }, [screen, quizIdx]);

  const currentBatch = batches[batchIdx] ?? [];

  async function selectSet(ws: WordSet) {
    const res = await fetch(`/api/wordsets/${ws.id}/words`);
    const words: Word[] = await res.json();
    if (words.length < 4) { alert("단어가 최소 4개 이상 필요해요!"); return; }
    const shuffled = shuffle(words);
    const bs: Word[][] = [];
    for (let i = 0; i < shuffled.length; i += BATCH_SIZE) {
      bs.push(shuffled.slice(i, i + BATCH_SIZE));
    }
    setAllWords(words);
    setBatches(bs);
    setSelectedSet(ws);
    setBatchIdx(0);
    setTotalScore(0);
    setTotalQuestions(0);
    setScreen("study");
    setAnimKey(k => k + 1);
  }

  function startQuiz(s: Screen, batch: Word[], idx = 0) {
    setQuizIdx(idx);
    setSelected(null);
    setIsCorrect(null);
    setTyped("");
    setBatchScore(0);
    buildChoices(s, batch, idx);
    setScreen(s);
    setAnimKey(k => k + 1);
  }

  function buildChoices(s: Screen, batch: Word[], idx: number) {
    const q = batch[idx];
    if (!q) return;
    if (s === "quiz-mtw") setChoices(getChoices(q, allWords, "english"));
    if (s === "quiz-wtm") setChoices(getChoices(q, allWords, "korean"));
  }

  function handleChoice(choice: string) {
    if (selected !== null) return;
    const q = currentBatch[quizIdx];
    const correct = screen === "quiz-mtw" ? q.english : q.korean;
    const ok = choice === correct;
    setSelected(choice);
    setIsCorrect(ok);
    if (ok) { setTotalScore(s => s + 1); setBatchScore(s => s + 1); }
    setTotalQuestions(n => n + 1);
    setTimeout(() => nextQuizStep(), 800);
  }

  function handleTypingSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isCorrect !== null) return;
    const q = currentBatch[quizIdx];
    const ok = typed.trim().toLowerCase() === q.english.toLowerCase();
    setIsCorrect(ok);
    if (ok) { setTotalScore(s => s + 1); setBatchScore(s => s + 1); }
    setTotalQuestions(n => n + 1);
    setTimeout(() => { nextQuizStep(); setTyped(""); }, 800);
  }

  function nextQuizStep() {
    const nextIdx = quizIdx + 1;
    if (nextIdx < currentBatch.length) {
      setQuizIdx(nextIdx);
      setSelected(null);
      setIsCorrect(null);
      if (screen !== "quiz-typing") buildChoices(screen, currentBatch, nextIdx);
      setAnimKey(k => k + 1);
    } else {
      // 현재 퀴즈 단계 끝 → 다음 단계로
      if (screen === "quiz-mtw") {
        setQuizIdx(0); setSelected(null); setIsCorrect(null); setTyped("");
        buildChoices("quiz-wtm", currentBatch, 0);
        setScreen("quiz-wtm");
        setAnimKey(k => k + 1);
      } else if (screen === "quiz-wtm") {
        setQuizIdx(0); setSelected(null); setIsCorrect(null); setTyped("");
        setScreen("quiz-typing");
        setAnimKey(k => k + 1);
      } else if (screen === "quiz-typing") {
        setScreen("batch-result");
        saveBatchScore();
      }
    }
  }

  async function saveBatchScore() {
    try {
      await fetch("/api/challenge/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: totalScore,
          totalQuestions: totalQuestions + 1,
          mode: "FULL",
          wordSetId: selectedSet?.id,
        }),
      });
    } catch {}
  }

  function nextBatch() {
    const next = batchIdx + 1;
    if (next >= batches.length) {
      setScreen("all-done");
    } else {
      setBatchIdx(next);
      setScreen("study");
      setAnimKey(k => k + 1);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  // ── 단어장 선택 ──
  if (screen === "select-set") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 px-4 py-8">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-extrabold text-white">📚 학년 선택</h1>
            <button onClick={handleLogout} className="text-white/60 hover:text-white text-sm">로그아웃</button>
          </div>
          <p className="text-purple-200 text-sm mb-5">학년을 선택하면 5개씩 묶어서 외우고 테스트해요!</p>
          <div className="grid grid-cols-2 gap-4">
            {wordSets.map(ws => (
              <button key={ws.id} onClick={() => selectSet(ws)}
                className="bg-white rounded-2xl p-5 text-left shadow-lg hover:scale-105 active:scale-95 transition-transform">
                <p className="text-4xl mb-2">{ws.emoji}</p>
                <p className="font-extrabold text-gray-800 text-lg">{ws.name}</p>
                <p className="text-xs text-gray-400 mt-1">{ws._count.words}개 단어</p>
                <p className="text-xs text-purple-400 mt-1 font-bold">
                  {Math.ceil(ws._count.words / BATCH_SIZE)}그룹 × 5단어
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const totalBatches = batches.length;
  const progressPct = totalBatches > 0 ? Math.round((batchIdx / totalBatches) * 100) : 0;

  // ── 외우기 ──
  if (screen === "study") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* 상단 */}
        <div className="bg-white px-4 py-3 shadow-sm flex items-center gap-3">
          <button onClick={() => setScreen("select-set")} className="text-gray-400 text-sm">✕</button>
          <div className="flex-1">
            <p className="text-xs text-gray-400">{selectedSet?.emoji} {selectedSet?.name}</p>
            <p className="text-sm font-bold text-gray-700">그룹 {batchIdx + 1} / {totalBatches} · 외우기</p>
          </div>
          <span className="text-sm font-bold text-violet-500">{progressPct}%</span>
        </div>
        <div className="h-2 bg-gray-200">
          <div className="h-full bg-violet-400 transition-all duration-500 rounded-r-full" style={{ width: `${progressPct}%` }} />
        </div>

        <div key={animKey} className="bounce-in flex-1 max-w-lg mx-auto w-full px-4 py-5 flex flex-col gap-3">
          <div className="bg-violet-50 rounded-2xl px-4 py-3 text-center mb-1">
            <p className="text-sm font-bold text-violet-600">📖 아래 단어 {currentBatch.length}개를 외워보세요!</p>
          </div>

          {currentBatch.map((w, i) => (
            <div key={w.id} className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4 border border-gray-100">
              <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-extrabold text-sm shrink-0">
                {i + 1}
              </div>
              <div className="flex-1">
                <p className="font-extrabold text-gray-800 text-lg">{w.english}</p>
                <p className="text-gray-500 text-sm mt-0.5">{w.korean}</p>
              </div>
            </div>
          ))}

          <button onClick={() => startQuiz("quiz-mtw", currentBatch)}
            className="mt-3 w-full py-4 rounded-2xl text-white font-extrabold text-lg shadow-lg bg-gradient-to-r from-violet-500 to-indigo-500">
            외웠어요! 테스트 시작 →
          </button>
        </div>
      </div>
    );
  }

  // ── 배치 결과 ──
  if (screen === "batch-result") {
    const batchTotal = currentBatch.length * 3;
    const pct = batchTotal > 0 ? Math.round((batchScore / batchTotal) * 100) : 0;
    const emoji = pct === 100 ? "🏆" : pct >= 70 ? "🎉" : pct >= 40 ? "😊" : "💪";
    const msg   = pct === 100 ? "완벽해요!" : pct >= 70 ? "잘했어요!" : pct >= 40 ? "좋아요!" : "다시 도전해봐요!";
    const isLast = batchIdx + 1 >= batches.length;

    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-500 to-indigo-600 flex flex-col items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm text-center bounce-in">
          <div className="text-6xl mb-2">{emoji}</div>
          <h2 className="text-2xl font-extrabold text-gray-800 mb-1">{msg}</h2>
          <p className="text-gray-400 text-sm mb-5">그룹 {batchIdx + 1} 완료!</p>

          <div className="flex justify-center gap-4 mb-5">
            <div className="bg-violet-50 rounded-2xl px-5 py-4">
              <p className="text-3xl font-extrabold text-violet-600">{batchScore}<span className="text-lg">/{batchTotal}</span></p>
              <p className="text-xs text-gray-400 mt-1">정답</p>
            </div>
            <div className="bg-yellow-50 rounded-2xl px-5 py-4">
              <p className="text-3xl font-extrabold text-yellow-500">{pct}%</p>
              <p className="text-xs text-gray-400 mt-1">정확도</p>
            </div>
          </div>

          <div className="h-2.5 bg-gray-100 rounded-full mb-6">
            <div className="h-full rounded-full bg-violet-400 transition-all" style={{ width: `${pct}%` }} />
          </div>

          <div className="space-y-3">
            <button onClick={nextBatch}
              className="w-full py-4 rounded-2xl text-white font-extrabold text-lg bg-gradient-to-r from-violet-500 to-indigo-500 shadow-lg">
              {isLast ? "🎊 전체 완료!" : `다음 그룹 (${batchIdx + 2}/${totalBatches}) →`}
            </button>
            <button onClick={() => { setScreen("study"); setAnimKey(k => k + 1); }}
              className="w-full py-3 rounded-2xl border-2 border-violet-300 text-violet-600 font-bold text-sm">
              🔄 이 그룹 다시 하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 전체 완료 ──
  if (screen === "all-done") {
    const allTotal = totalBatches * BATCH_SIZE * 3;
    const pct = allTotal > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;

    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-500 to-indigo-600 flex flex-col items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm text-center bounce-in">
          <div className="text-7xl mb-3">🏆</div>
          <h2 className="text-3xl font-extrabold text-gray-800 mb-1">전체 완료!</h2>
          <p className="text-gray-400 text-sm mb-6">{selectedSet?.name} · 모든 단어를 마쳤어요! 🎊</p>

          <div className="flex justify-center gap-4 mb-6">
            <div className="bg-violet-50 rounded-2xl px-5 py-4">
              <p className="text-3xl font-extrabold text-violet-600">{totalScore}<span className="text-lg">/{totalQuestions}</span></p>
              <p className="text-xs text-gray-400 mt-1">총 정답</p>
            </div>
            <div className="bg-yellow-50 rounded-2xl px-5 py-4">
              <p className="text-3xl font-extrabold text-yellow-500">{pct}%</p>
              <p className="text-xs text-gray-400 mt-1">정확도</p>
            </div>
          </div>

          <div className="space-y-3">
            <button onClick={() => selectSet(selectedSet!)}
              className="w-full py-4 rounded-2xl text-white font-extrabold text-lg bg-gradient-to-r from-violet-500 to-indigo-500 shadow-lg">
              🔄 처음부터 다시!
            </button>
            <button onClick={() => setScreen("select-set")}
              className="w-full py-3 rounded-2xl border-2 border-violet-300 text-violet-600 font-bold text-sm">
              다른 학년 하기
            </button>
            <button onClick={() => router.push("/")} className="w-full py-3 text-gray-400 text-sm">
              홈으로 →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 퀴즈 공통 ──
  const q = currentBatch[quizIdx];
  if (!q) return null;

  const isMTW     = screen === "quiz-mtw";
  const isWTM     = screen === "quiz-wtm";
  const isTyping  = screen === "quiz-typing";

  const stepNum   = isMTW ? 1 : isWTM ? 2 : 3;
  const stepLabel = isMTW ? "뜻 보고 단어 고르기 🇺🇸" : isWTM ? "단어 보고 뜻 고르기 🇰🇷" : "단어 직접 타이핑 ⌨️";
  const colors    = ["#6366f1", "#0ea5e9", "#10b981"];
  const color     = colors[stepNum - 1];

  const quizProgress = ((quizIdx) / currentBatch.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 상단 */}
      <div className="bg-white px-4 py-3 shadow-sm flex items-center gap-3">
        <button onClick={() => setScreen("study")} className="text-gray-400 text-sm">← 외우기</button>
        <div className="flex-1 text-center">
          <p className="text-xs text-gray-400">그룹 {batchIdx + 1}/{totalBatches} · 테스트 {stepNum}/3</p>
          <p className="text-sm font-bold text-gray-700">{stepLabel}</p>
        </div>
        <span className="text-sm font-bold" style={{ color }}>{quizIdx + 1}/{currentBatch.length}</span>
      </div>

      {/* 진행 바 */}
      <div className="h-2 bg-gray-200">
        <div className="h-full transition-all duration-500 rounded-r-full"
          style={{ width: `${quizProgress}%`, background: color }} />
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-5 flex flex-col gap-4">
        {/* 문제 카드 */}
        <div key={animKey} className="bounce-in bg-white rounded-3xl shadow-md p-6 text-center">
          {isMTW && (
            <>
              <p className="text-xs text-gray-400 mb-2">이 뜻의 영어 단어는?</p>
              <p className="text-4xl font-extrabold text-gray-800">{q.korean}</p>
            </>
          )}
          {isWTM && (
            <>
              <p className="text-xs text-gray-400 mb-2">이 단어의 한국어 뜻은?</p>
              <p className="text-4xl font-extrabold text-gray-800">{q.english}</p>
            </>
          )}
          {isTyping && (
            <>
              <p className="text-xs text-gray-400 mb-2">영어로 입력해보세요</p>
              <p className="text-4xl font-extrabold text-gray-800">{q.korean}</p>
            </>
          )}
          {isCorrect === true  && <p className="mt-3 text-green-500 font-extrabold animate-bounce">✅ 정답!</p>}
          {isCorrect === false && (
            <p className="mt-3 text-red-500 font-bold text-sm">
              ❌ 정답: <span className="font-extrabold">{isMTW ? q.english : isWTM ? q.korean : q.english}</span>
            </p>
          )}
        </div>

        {/* 객관식 */}
        {(isMTW || isWTM) && (
          <div className="grid grid-cols-2 gap-3">
            {choices.map(choice => {
              const correctAnswer = isMTW ? q.english : q.korean;
              const isTheCorrect  = choice === correctAnswer;
              const isSelected    = selected === choice;
              let cls = "bg-white border-2 border-gray-200 text-gray-800 shadow-sm";
              if (selected !== null) {
                if (isTheCorrect)                cls = "bg-green-100 border-2 border-green-400 text-green-800";
                else if (isSelected)             cls = "bg-red-100 border-2 border-red-400 text-red-700";
                else                             cls = "bg-white border-2 border-gray-100 text-gray-300";
              }
              return (
                <button key={choice} onClick={() => handleChoice(choice)} disabled={selected !== null}
                  className={`rounded-2xl p-4 text-center font-bold text-base transition-all active:scale-95 ${cls}`}>
                  {choice}
                </button>
              );
            })}
          </div>
        )}

        {/* 타이핑 */}
        {isTyping && (
          <form onSubmit={handleTypingSubmit} className="space-y-3">
            <input ref={inputRef} type="text" value={typed}
              onChange={e => { setTyped(e.target.value); setIsCorrect(null); }}
              disabled={isCorrect !== null}
              placeholder="영어로 입력하세요..."
              autoComplete="off" autoCorrect="off" spellCheck={false}
              className={`w-full border-2 rounded-2xl px-5 py-4 text-xl text-center font-bold outline-none transition-all
                ${isCorrect === true ? "border-green-400 bg-green-50" : isCorrect === false ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-emerald-400"}`}
            />
            <button type="submit" disabled={!typed.trim() || isCorrect !== null}
              className="w-full py-4 rounded-2xl text-white font-extrabold text-lg shadow-lg transition-all disabled:opacity-40"
              style={{ background: color }}>
              확인 ✓
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
