"use client";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function speak(text: string) {
  if (typeof window === "undefined") return;
  const audio = new Audio(`/api/tts?q=${encodeURIComponent(text)}`);
  audio.play().catch(() => {});
}

interface WordSet { id: number; name: string; emoji: string; description: string; _count: { words: number }; }
interface Word    { id: number; english: string; korean: string; }

type Screen = "select-set" | "study" | "quiz-mtw" | "quiz-wtm" | "copy-typing" | "quiz-typing" | "stage-fail" | "batch-result" | "all-done";
const COPY_ROUNDS = 3;
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

// ── 남색 퀴즈 헤더 ──
function QuizHeader({ top, bottom, current, total }: { top: string; bottom: string; current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div style={{ background: "#1F2A44" }}>
      <div style={{ padding: "14px 20px 10px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", marginBottom: "2px" }}>{top}</div>
          <div style={{ fontSize: "13px", fontWeight: 800, color: "#F6E27F" }}>{bottom}</div>
        </div>
        <div style={{ fontSize: "12px", fontWeight: 900, color: "rgba(255,255,255,0.6)" }}>{current}/{total}</div>
      </div>
      <div style={{ height: "5px", background: "rgba(255,255,255,0.12)", margin: "0 0 0 0" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "#F6E27F", transition: "width 0.4s" }} />
      </div>
    </div>
  );
}

// ── 하단 전체 진행바 ──
function GradeProgressBar({ batchIdx, totalBatches }: { batchIdx: number; totalBatches: number }) {
  const pct = totalBatches > 0 ? Math.round((batchIdx / totalBatches) * 100) : 0;
  return (
    <div style={{ padding: "10px 20px 18px", background: "#fff", borderTop: "1px solid #F0ECE0" }}>
      <div style={{ maxWidth: "420px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
          <span style={{ fontSize: "10px", color: "#AAAAAA", fontWeight: 700 }}>전체 진행도</span>
          <span style={{ fontSize: "10px", color: "#1F2A44", fontWeight: 900 }}>{batchIdx}/{totalBatches} 그룹 ({pct}%)</span>
        </div>
        <div style={{ height: "8px", background: "#F0ECE0", borderRadius: "999px", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "#76C043", borderRadius: "999px", transition: "width 0.5s" }} />
        </div>
      </div>
    </div>
  );
}

function ChallengePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [wordSets, setWordSets]       = useState<WordSet[]>([]);
  const [progressMap, setProgressMap] = useState<Record<number, number>>({});
  const [allWords, setAllWords]       = useState<Word[]>([]);
  const [batches, setBatches]         = useState<Word[][]>([]);
  const [selectedSet, setSelectedSet] = useState<WordSet | null>(null);
  const [screen, setScreen]           = useState<Screen>("select-set");
  const [batchIdx, setBatchIdx]       = useState(0);
  const [quizIdx, setQuizIdx]         = useState(0);
  const [choices, setChoices]         = useState<string[]>([]);
  const [selected, setSelected]       = useState<string | null>(null);
  const [isCorrect, setIsCorrect]     = useState<boolean | null>(null);
  const [typed, setTyped]             = useState("");
  const [totalScore, setTotalScore]       = useState(0);
  const [batchScore, setBatchScore]       = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [stageCorrect, setStageCorrect]   = useState(0);
  const [stageFailed, setStageFailed]     = useState<Screen | null>(null);
  const [animKey, setAnimKey]         = useState(0);
  const [copyRound, setCopyRound]     = useState(1);
  const [copyIdx, setCopyIdx]         = useState(0);
  const [copyTyped, setCopyTyped]     = useState("");
  const [copyOk, setCopyOk]           = useState<boolean | null>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const copyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => {
        if (!r.ok) { router.push("/"); return; }
        if (searchParams.get("startSet")) return;
        return fetch("/api/challenge/score/me")
          .then(r2 => r2.json())
          .then(d => { if (d?.isFirst) router.push("/placement"); })
          .catch(() => {});
      })
      .catch(() => router.push("/"));
    fetch("/api/wordsets").then(r => r.json()).then((sets: WordSet[]) => {
      setWordSets(sets);
      const startSetId = Number(searchParams.get("startSet"));
      if (startSetId) {
        const target = sets.find(ws => ws.id === startSetId);
        if (target) setTimeout(() => selectSet(target), 100);
        return;
      }
      const placedId    = typeof window !== "undefined" ? Number(localStorage.getItem("wc_placed_id") || 0) : 0;
      const unlockedIdx = typeof window !== "undefined" ? Number(localStorage.getItem("wc_unlocked_idx") ?? -1) : -1;
      if (placedId && unlockedIdx >= 0 && unlockedIdx < sets.length) {
        const target = sets[unlockedIdx];
        if (target) setTimeout(() => selectSet(target), 100);
        return;
      }
      Promise.all(sets.map(ws => fetch(`/api/progress?wordSetId=${ws.id}`).then(r => r.ok ? r.json() : null)))
        .then(results => {
          const map: Record<number, number> = {};
          results.forEach((p, i) => { if (p?.batchIdx > 0) map[sets[i].id] = p.batchIdx; });
          setProgressMap(map);
        }).catch(() => {});
    }).catch(() => {});
  }, [router]);

  useEffect(() => {
    if (screen === "quiz-typing") inputRef.current?.focus();
    if (screen === "copy-typing") { setCopyTyped(""); setCopyOk(null); setTimeout(() => copyInputRef.current?.focus(), 100); }
  }, [screen, quizIdx, copyIdx, copyRound]);

  const currentBatch = batches[batchIdx] ?? [];

  async function selectSet(ws: WordSet) {
    const [wordsRes, progressRes] = await Promise.all([
      fetch(`/api/wordsets/${ws.id}/words`),
      fetch(`/api/progress?wordSetId=${ws.id}`),
    ]);
    const words: Word[] = await wordsRes.json();
    if (words.length < 4) { alert("단어가 최소 4개 이상 필요해요!"); return; }

    const progress = progressRes.ok ? await progressRes.json() : null;

    let ordered: Word[];
    let startBatch = 0;

    if (progress?.wordOrder) {
      const ids: number[] = JSON.parse(progress.wordOrder);
      const wordMap = new Map(words.map(w => [w.id, w]));
      const restored = ids.map(id => wordMap.get(id)).filter(Boolean) as Word[];
      const missing = words.filter(w => !ids.includes(w.id));
      ordered = [...restored, ...missing];
      startBatch = progress.batchIdx ?? 0;
    } else {
      ordered = [...words];
    }

    const bs: Word[][] = [];
    for (let i = 0; i < ordered.length; i += BATCH_SIZE) {
      bs.push(ordered.slice(i, i + BATCH_SIZE));
    }

    setAllWords(words);
    setBatches(bs);
    setSelectedSet(ws);
    setBatchIdx(startBatch);
    setTotalScore(0);
    setTotalQuestions(0);
    setScreen("study");
    setAnimKey(k => k + 1);

    if (!progress) {
      fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordSetId: ws.id, batchIdx: 0, wordOrder: ordered.map(w => w.id) }),
      }).catch(() => {});
    }
  }

  function startQuiz(s: Screen, batch: Word[], idx = 0) {
    setQuizIdx(idx);
    setSelected(null);
    setIsCorrect(null);
    setTyped("");
    setBatchScore(0);
    setStageCorrect(0);
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
    if (ok) { setTotalScore(s => s + 1); setBatchScore(s => s + 1); setStageCorrect(s => s + 1); }
    setTotalQuestions(n => n + 1);
    setTimeout(() => nextQuizStep(ok), 800);
  }

  function handleTypingSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isCorrect !== null) return;
    const q = currentBatch[quizIdx];
    const ok = typed.trim().toLowerCase() === q.english.toLowerCase();
    setIsCorrect(ok);
    if (ok) { setTotalScore(s => s + 1); setBatchScore(s => s + 1); setStageCorrect(s => s + 1); }
    setTotalQuestions(n => n + 1);
    setTimeout(() => { nextQuizStep(ok); setTyped(""); }, 800);
  }

  function nextQuizStep(lastCorrect = true) {
    const nextIdx = quizIdx + 1;
    if (nextIdx < currentBatch.length) {
      setQuizIdx(nextIdx);
      setSelected(null);
      setIsCorrect(null);
      if (screen !== "quiz-typing") buildChoices(screen, currentBatch, nextIdx);
      setAnimKey(k => k + 1);
    } else {
      const correct = stageCorrect + (lastCorrect ? 1 : 0);
      const total   = currentBatch.length;
      const passed  = correct / total >= 0.9;

      if (screen === "quiz-mtw") {
        if (!passed) { setStageFailed("quiz-mtw"); setScreen("stage-fail"); return; }
        setQuizIdx(0); setSelected(null); setIsCorrect(null); setTyped("");
        setStageCorrect(0);
        buildChoices("quiz-wtm", currentBatch, 0);
        setScreen("quiz-wtm");
        setAnimKey(k => k + 1);
      } else if (screen === "quiz-wtm") {
        if (!passed) { setStageFailed("quiz-wtm"); setScreen("stage-fail"); return; }
        setStageCorrect(0);
        setCopyRound(1); setCopyIdx(0); setCopyTyped(""); setCopyOk(null);
        setScreen("copy-typing");
        setAnimKey(k => k + 1);
      } else if (screen === "quiz-typing") {
        setScreen("batch-result");
        saveBatchScore();
      }
    }
  }

  function handleCopySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (copyOk !== null) return;
    const q = currentBatch[copyIdx];
    const ok = copyTyped.trim().toLowerCase() === q.english.toLowerCase();
    setCopyOk(ok);
    if (!ok) {
      setTimeout(() => { setCopyTyped(""); setCopyOk(null); copyInputRef.current?.focus(); }, 700);
      return;
    }
    setTimeout(() => {
      setCopyTyped(""); setCopyOk(null);
      const nextRound = copyRound + 1;
      if (nextRound <= COPY_ROUNDS) {
        setCopyRound(nextRound);
      } else {
        const nextIdx = copyIdx + 1;
        if (nextIdx < currentBatch.length) {
          setCopyIdx(nextIdx);
          setCopyRound(1);
        } else {
          setQuizIdx(0); setSelected(null); setIsCorrect(null); setTyped("");
          setScreen("quiz-typing");
          setAnimKey(k => k + 1);
        }
      }
    }, 600);
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
      fetch(`/api/progress?wordSetId=${selectedSet?.id}`, { method: "DELETE" }).catch(() => {});
      if (typeof window !== "undefined" && localStorage.getItem("wc_placed_id")) {
        const curIdx = wordSets.findIndex(ws => ws.id === selectedSet?.id);
        const curUnlocked = Number(localStorage.getItem("wc_unlocked_idx") ?? curIdx);
        if (curIdx >= 0 && curIdx >= curUnlocked) {
          const nextIdx = curIdx + 1;
          if (nextIdx < wordSets.length) {
            localStorage.setItem("wc_unlocked_idx", String(nextIdx));
          } else {
            localStorage.removeItem("wc_placed_id");
            localStorage.removeItem("wc_unlocked_idx");
          }
        }
      }
      setScreen("all-done");
    } else {
      setBatchIdx(next);
      setScreen("study");
      setAnimKey(k => k + 1);
      const wordOrder = batches.flat().map(w => w.id);
      fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordSetId: selectedSet?.id, batchIdx: next, wordOrder }),
      }).catch(() => {});
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  const totalBatches = batches.length;

  // ── 단어장 선택 ──
  if (screen === "select-set") {
    if (searchParams.get("startSet")) {
      return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: "#FFF9E6" }}>
          <p className="text-lg font-bold animate-pulse" style={{ color: "#1F2A44" }}>학습 준비 중... ✨</p>
        </div>
      );
    }
    const placedId    = typeof window !== "undefined" ? Number(localStorage.getItem("wc_placed_id") || 0) : 0;
    const unlockedIdx = typeof window !== "undefined" ? Number(localStorage.getItem("wc_unlocked_idx") ?? -1) : -1;
    const placedSet   = placedId ? wordSets.find(ws => ws.id === placedId) : null;

    return (
      <div className="min-h-screen px-4 py-8" style={{ background: "#FFF9E6" }}>
        <div className="max-w-lg mx-auto">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <img src="/TheFluent/logo.clear.png" alt="The Fluent" style={{ height: "36px", objectFit: "contain" }} />
              <div>
                <div className="font-black text-sm" style={{ color: "#1F2A44" }}>단어 챌린지</div>
                <div className="text-xs" style={{ color: "#76C043" }}>학년을 선택해요!</div>
              </div>
            </div>
            <button onClick={handleLogout} className="text-xs" style={{ color: "#AAAAAA" }}>로그아웃</button>
          </div>

          {placedSet && (
            <div className="mb-5 rounded-2xl px-4 py-3 text-sm" style={{ background: "#FFFBEE", border: "1.5px solid #F0E8C8" }}>
              🎯 레벨 테스트 결과 <span className="font-black" style={{ color: "#1F2A44" }}>{placedSet.emoji} {placedSet.name}</span>이 추천됐어요!
              <div className="text-xs mt-1" style={{ color: "#AAAAAA" }}>추천 학년을 완료하면 다른 학년도 도전할 수 있어요 💪</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {wordSets.map(ws => {
              const savedBatch = progressMap[ws.id];
              const totalGroups = Math.ceil(ws._count.words / BATCH_SIZE);
              const wsIdx    = wordSets.findIndex(w => w.id === ws.id);
              const isLocked = placedId > 0 && wsIdx > unlockedIdx;
              const gradeNum = ws.name.replace("학년", "");

              if (isLocked) {
                return (
                  <div key={ws.id} style={{ position: "relative", background: "#F5F5F5", border: "1.5px solid #E8E8E8", borderRadius: "20px", padding: "20px", overflow: "hidden", cursor: "not-allowed", opacity: 0.55 }}>
                    <img src="/TheFluent/logo.symbol.png" alt="" style={{ position: "absolute", width: "60px", height: "60px", objectFit: "contain", bottom: "-8px", right: "-6px", opacity: 0.06, filter: "grayscale(1)" }} />
                    <span style={{ position: "absolute", top: "12px", right: "12px", fontSize: "16px" }}>🔒</span>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "3px", marginBottom: "4px" }}>
                      <span style={{ fontSize: "28px", fontWeight: 900, color: "#CCCCCC", lineHeight: 1 }}>{gradeNum}</span>
                      <span style={{ fontSize: "11px", color: "#CCCCCC" }}>학년</span>
                    </div>
                    <div className="text-xs" style={{ color: "#CCCCCC" }}>{ws._count.words}개 단어</div>
                    <div className="text-xs mt-1" style={{ color: "#CCCCCC" }}>추천 학년 완료 후 해제</div>
                  </div>
                );
              }

              const isRecommended = placedId > 0 && wsIdx === wordSets.findIndex(w => w.id === placedId);
              const isNewlyUnlocked = placedId > 0 && wsIdx === unlockedIdx && !isRecommended;

              return (
                <button key={ws.id} onClick={() => selectSet(ws)}
                  style={{ position: "relative", background: "#fff", border: isRecommended ? "2px solid #F6E27F" : "1.5px solid #F0E8C8", borderRadius: "20px", padding: "20px", overflow: "hidden", textAlign: "left", transition: "transform 0.15s", cursor: "pointer" }}
                  className="hover:scale-105 active:scale-95">
                  <img src="/TheFluent/logo.symbol.png" alt="" style={{ position: "absolute", width: "60px", height: "60px", objectFit: "contain", bottom: "-8px", right: "-6px", opacity: isRecommended ? 0.16 : 0.08 }} />
                  {isRecommended && (
                    <span style={{ position: "absolute", top: "10px", right: "10px", fontSize: "9px", background: "#F6E27F", color: "#1F2A44", borderRadius: "999px", padding: "2px 8px", fontWeight: 900 }}>추천!</span>
                  )}
                  {isNewlyUnlocked && (
                    <span style={{ position: "absolute", top: "10px", right: "10px", fontSize: "9px", background: "#76C043", color: "#fff", borderRadius: "999px", padding: "2px 8px", fontWeight: 900 }}>🔓 해제!</span>
                  )}
                  {savedBatch > 0 && placedId === 0 && (
                    <span style={{ position: "absolute", top: "10px", right: "10px", fontSize: "9px", background: "#1F2A44", color: "#F6E27F", borderRadius: "999px", padding: "2px 8px", fontWeight: 900 }}>이어하기</span>
                  )}
                  <div style={{ display: "flex", alignItems: "baseline", gap: "3px", marginBottom: "4px", position: "relative", zIndex: 1 }}>
                    <span style={{ fontSize: "28px", fontWeight: 900, color: "#1F2A44", lineHeight: 1 }}>{gradeNum}</span>
                    <span style={{ fontSize: "11px", color: "#8A96A8" }}>학년</span>
                  </div>
                  <div className="text-xs" style={{ color: "#AAAAAA", position: "relative", zIndex: 1 }}>{ws._count.words}개 단어</div>
                  {savedBatch > 0 ? (
                    <div className="text-xs font-bold mt-1" style={{ color: "#76C043", position: "relative", zIndex: 1 }}>{savedBatch}/{totalGroups} 그룹 완료</div>
                  ) : (
                    <div className="text-xs font-bold mt-1" style={{ color: "#AAAAAA", position: "relative", zIndex: 1 }}>{totalGroups}그룹 × 5단어</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── 외우기 (플래시카드) ──
  if (screen === "study") {
    return <FlashCards
      batch={currentBatch}
      batchIdx={batchIdx}
      totalBatches={totalBatches}
      selectedSet={selectedSet}
      onExit={() => setScreen("select-set")}
      onDone={() => startQuiz("quiz-mtw", currentBatch)}
    />;
  }

  // ── 따라쓰기 ──
  if (screen === "copy-typing") {
    const cq = currentBatch[copyIdx];
    if (!cq) return null;
    const copyProgress = ((copyRound - 1) * currentBatch.length + copyIdx) / (COPY_ROUNDS * currentBatch.length) * 100;

    return (
      <div className="min-h-screen flex flex-col" style={{ background: "#FFF9E6" }}>
        <QuizHeader
          top={`그룹 ${batchIdx + 1}/${totalBatches} · 따라쓰기`}
          bottom={`⌨️ 보고 따라쓰기 ${copyRound}/${COPY_ROUNDS}회`}
          current={copyIdx + 1}
          total={currentBatch.length}
        />

        <div className="flex-1 flex flex-col items-center justify-center px-5 gap-5">
          <div className="w-full max-w-sm text-center" style={{ background: "#fff", border: "1.5px solid #F0E8C8", borderRadius: "20px", padding: "28px 24px" }}>
            <p className="text-xs font-black mb-1 uppercase tracking-widest" style={{ color: "#AAAAAA" }}>따라 써보세요</p>
            <p className="text-4xl font-black mb-1" style={{ color: "#1F2A44" }}>{cq.english}</p>
            <p className="text-lg font-black" style={{ color: "#76C043" }}>{cq.korean}</p>
            <button onClick={() => speak(cq.english)} className="mt-4 w-10 h-10 rounded-full inline-flex items-center justify-center text-lg" style={{ background: "#FFFBEE" }}>
              🔊
            </button>
          </div>

          <form onSubmit={handleCopySubmit} className="w-full max-w-sm space-y-3">
            <input
              ref={copyInputRef}
              type="text"
              value={copyTyped}
              onChange={e => { setCopyTyped(e.target.value); setCopyOk(null); }}
              disabled={copyOk === true}
              placeholder={cq.english.replace(/./g, "_ ")}
              autoComplete="off" autoCorrect="off" spellCheck={false}
              className="w-full rounded-2xl px-5 py-4 text-xl text-center font-bold outline-none transition-all"
              style={{
                border: copyOk === true ? "2px solid #76C043" : copyOk === false ? "2px solid #E8463A" : "2px solid #E8E0C8",
                background: copyOk === true ? "#F0FBE8" : copyOk === false ? "#FFF0EE" : "#fff",
              }}
            />
            {copyOk === true  && <p className="text-center font-black" style={{ color: "#76C043" }}>✅ 잘했어요!</p>}
            {copyOk === false && <p className="text-center font-bold text-sm" style={{ color: "#E8463A" }}>❌ 다시 입력해보세요</p>}
            {copyOk === null && (
              <button type="submit" disabled={!copyTyped.trim()}
                className="w-full py-4 rounded-2xl font-black text-lg transition-all disabled:opacity-40"
                style={{ background: "#1F2A44", color: "#F6E27F" }}>
                확인 ✓
              </button>
            )}
          </form>
        </div>

        <GradeProgressBar batchIdx={batchIdx} totalBatches={totalBatches} />
      </div>
    );
  }

  // ── 단계 실패 ──
  if (screen === "stage-fail") {
    const stageLabel = stageFailed === "quiz-mtw" ? "뜻 보고 단어 고르기" : "단어 보고 뜻 고르기";
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "#FFF9E6" }}>
        <div className="w-full max-w-sm text-center" style={{ background: "#fff", border: "1.5px solid #F0E8C8", borderRadius: "24px", padding: "32px 28px" }}>
          <div className="text-6xl mb-3">😅</div>
          <h2 className="text-2xl font-black mb-2" style={{ color: "#1F2A44" }}>아직 부족해요!</h2>
          <p className="text-sm mb-2" style={{ color: "#8A96A8", lineHeight: 1.7 }}>
            <span className="font-black" style={{ color: "#E8463A" }}>"{stageLabel}"</span> 단계를<br />90% 이상 맞춰야 다음으로 갈 수 있어요
          </p>
          <p className="text-xs mb-6" style={{ color: "#AAAAAA" }}>단어를 다시 외우고 도전해보세요 💪</p>
          <button
            onClick={() => { setScreen("study"); setAnimKey(k => k + 1); }}
            className="w-full py-4 rounded-2xl font-black text-lg transition-all active:scale-95"
            style={{ background: "#1F2A44", color: "#F6E27F" }}>
            📖 처음부터 다시 외우기
          </button>
        </div>
      </div>
    );
  }

  // ── 배치 결과 ──
  if (screen === "batch-result") {
    const batchTotal = currentBatch.length * 3;
    const pct = batchTotal > 0 ? Math.round((batchScore / batchTotal) * 100) : 0;
    const passed = pct >= 90;
    const isLast = batchIdx + 1 >= batches.length;
    const emoji = pct === 100 ? "🏆" : pct >= 90 ? "🎉" : pct >= 60 ? "😅" : "💪";
    const msg   = pct === 100 ? "완벽해요!" : pct >= 90 ? "통과! 잘했어요!" : pct >= 60 ? "조금 더 해봐요!" : "다시 도전해요!";

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "#FFF9E6" }}>
        <div className="w-full max-w-sm text-center bounce-in" style={{ background: "#fff", border: "1.5px solid #F0E8C8", borderRadius: "24px", padding: "32px 28px" }}>
          <div className="text-6xl mb-2">{emoji}</div>
          <h2 className="text-2xl font-black mb-1" style={{ color: "#1F2A44" }}>{msg}</h2>
          <p className="text-sm mb-5" style={{ color: "#AAAAAA" }}>그룹 {batchIdx + 1} · 정확도 {pct}%</p>

          <div className="flex justify-center gap-4 mb-5">
            <div className="rounded-2xl px-5 py-4" style={{ background: "#FFFBEE", border: "1.5px solid #F0E8C8" }}>
              <p className="text-3xl font-black" style={{ color: "#1F2A44" }}>{batchScore}<span className="text-lg">/{batchTotal}</span></p>
              <p className="text-xs mt-1" style={{ color: "#AAAAAA" }}>정답</p>
            </div>
            <div className="rounded-2xl px-5 py-4" style={{ background: passed ? "#F0FBE8" : "#FFF0EE", border: `1.5px solid ${passed ? "#B8ECA0" : "#F0C0BC"}` }}>
              <p className="text-3xl font-black" style={{ color: passed ? "#76C043" : "#E8463A" }}>{pct}%</p>
              <p className="text-xs mt-1" style={{ color: "#AAAAAA" }}>정확도</p>
            </div>
          </div>

          <div className="h-2.5 rounded-full mb-2" style={{ background: "#F0ECE0" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: passed ? "#76C043" : "#E8463A" }} />
          </div>
          <p className="text-xs mb-6" style={{ color: "#AAAAAA" }}>
            {passed ? "✅ 90% 이상 달성!" : "⚠️ 다음 단계로 가려면 90% 이상이어야 해요"}
          </p>

          {passed ? (
            <button onClick={nextBatch}
              className="w-full py-4 rounded-2xl font-black text-lg transition-all active:scale-95"
              style={{ background: "#1F2A44", color: "#F6E27F" }}>
              {isLast ? "🎊 전체 완료!" : `다음 그룹 (${batchIdx + 2}/${totalBatches}) →`}
            </button>
          ) : (
            <button onClick={() => { setScreen("study"); setAnimKey(k => k + 1); }}
              className="w-full py-4 rounded-2xl font-black text-lg transition-all active:scale-95"
              style={{ background: "#E8463A", color: "#fff" }}>
              📖 카드부터 다시 외우기!
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── 전체 완료 ──
  if (screen === "all-done") {
    const pct = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "#FFF9E6" }}>
        <div className="w-full max-w-sm text-center bounce-in" style={{ background: "#fff", border: "1.5px solid #F0E8C8", borderRadius: "24px", padding: "32px 28px" }}>
          <div className="text-7xl mb-3">🏆</div>
          <h2 className="text-3xl font-black mb-1" style={{ color: "#1F2A44" }}>전체 완료!</h2>
          <p className="text-sm mb-6" style={{ color: "#AAAAAA" }}>{selectedSet?.name} · 모든 단어를 마쳤어요! 🎊</p>

          <div className="flex justify-center gap-4 mb-6">
            <div className="rounded-2xl px-5 py-4" style={{ background: "#FFFBEE", border: "1.5px solid #F0E8C8" }}>
              <p className="text-3xl font-black" style={{ color: "#1F2A44" }}>{totalScore}<span className="text-lg">/{totalQuestions}</span></p>
              <p className="text-xs mt-1" style={{ color: "#AAAAAA" }}>총 정답</p>
            </div>
            <div className="rounded-2xl px-5 py-4" style={{ background: "#F0FBE8", border: "1.5px solid #B8ECA0" }}>
              <p className="text-3xl font-black" style={{ color: "#76C043" }}>{pct}%</p>
              <p className="text-xs mt-1" style={{ color: "#AAAAAA" }}>정확도</p>
            </div>
          </div>

          <div className="space-y-3">
            <button onClick={() => selectSet(selectedSet!)}
              className="w-full py-4 rounded-2xl font-black text-lg transition-all active:scale-95"
              style={{ background: "#1F2A44", color: "#F6E27F" }}>
              🔄 처음부터 다시!
            </button>
            <button onClick={() => setScreen("select-set")}
              className="w-full py-3 rounded-2xl font-bold text-sm border-2 transition-all"
              style={{ borderColor: "#F0E8C8", color: "#1F2A44" }}>
              다른 학년 하기
            </button>
            <button onClick={() => router.push("/")} className="w-full py-3 text-sm" style={{ color: "#AAAAAA" }}>
              홈으로 →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 퀴즈 공통 (mtw / wtm / typing) ──
  const q = currentBatch[quizIdx];
  if (!q) return null;

  const isMTW    = screen === "quiz-mtw";
  const isWTM    = screen === "quiz-wtm";
  const isTyping = screen === "quiz-typing";

  const stepNum   = isMTW ? 1 : isWTM ? 2 : 3;
  const stepLabel = isMTW ? "뜻 보고 단어 고르기 🇺🇸" : isWTM ? "단어 보고 뜻 고르기 🇰🇷" : "단어 직접 타이핑 ⌨️";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#FFF9E6" }}>
      <QuizHeader
        top={`그룹 ${batchIdx + 1}/${totalBatches} · 테스트 ${stepNum}/3`}
        bottom={stepLabel}
        current={quizIdx + 1}
        total={currentBatch.length}
      />

      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-5 flex flex-col gap-4">
        {/* 문제 카드 */}
        <div key={animKey} className="bounce-in text-center" style={{ background: "#fff", border: "1.5px solid #F0E8C8", borderRadius: "20px", padding: "28px 24px" }}>
          {isMTW && (
            <>
              <p className="text-xs font-black mb-2 uppercase tracking-widest" style={{ color: "#AAAAAA" }}>이 뜻의 영어 단어는?</p>
              <p className="text-4xl font-black" style={{ color: "#1F2A44" }}>{q.korean}</p>
            </>
          )}
          {isWTM && (
            <>
              <p className="text-xs font-black mb-2 uppercase tracking-widest" style={{ color: "#AAAAAA" }}>이 단어의 한국어 뜻은?</p>
              <p className="text-4xl font-black" style={{ color: "#1F2A44" }}>{q.english}</p>
            </>
          )}
          {isTyping && (
            <>
              <p className="text-xs font-black mb-2 uppercase tracking-widest" style={{ color: "#AAAAAA" }}>영어로 입력해보세요</p>
              <p className="text-4xl font-black" style={{ color: "#1F2A44" }}>{q.korean}</p>
            </>
          )}
          {isCorrect === true  && <p className="mt-3 font-black animate-bounce" style={{ color: "#76C043" }}>✅ 정답!</p>}
          {isCorrect === false && (
            <p className="mt-3 font-bold text-sm" style={{ color: "#E8463A" }}>
              ❌ 정답: <span className="font-black">{isMTW ? q.english : isWTM ? q.korean : q.english}</span>
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
              let bg = "#1F2A44";
              let color = "rgba(255,255,255,0.65)";
              let border = "none";
              if (selected !== null) {
                if (isTheCorrect)    { bg = "#76C043"; color = "#fff"; }
                else if (isSelected) { bg = "#E8463A"; color = "#fff"; }
                else                 { bg = "rgba(31,42,68,0.35)"; color = "rgba(255,255,255,0.3)"; }
              }
              return (
                <button key={choice} onClick={() => handleChoice(choice)} disabled={selected !== null}
                  className="rounded-2xl p-4 text-center font-bold text-sm transition-all active:scale-95"
                  style={{ background: bg, color, border }}>
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
              className="w-full rounded-2xl px-5 py-4 text-xl text-center font-bold outline-none transition-all"
              style={{
                border: isCorrect === true ? "2px solid #76C043" : isCorrect === false ? "2px solid #E8463A" : "2px solid #E8E0C8",
                background: isCorrect === true ? "#F0FBE8" : isCorrect === false ? "#FFF0EE" : "#fff",
              }}
            />
            <button type="submit" disabled={!typed.trim() || isCorrect !== null}
              className="w-full py-4 rounded-2xl font-black text-lg transition-all disabled:opacity-40 active:scale-95"
              style={{ background: "#1F2A44", color: "#F6E27F" }}>
              확인 ✓
            </button>
          </form>
        )}
      </div>

      <GradeProgressBar batchIdx={batchIdx} totalBatches={totalBatches} />
    </div>
  );
}

// ── 플래시카드 컴포넌트 ──
function FlashCards({ batch, batchIdx, totalBatches, selectedSet, onExit, onDone }: {
  batch: Word[];
  batchIdx: number;
  totalBatches: number;
  selectedSet: WordSet | null;
  onExit: () => void;
  onDone: () => void;
}) {
  const [cardIdx, setCardIdx]   = useState(0);
  const [phase, setPhase]       = useState<"showing" | "selecting">("showing");
  const [choices, setChoices]   = useState<string[]>([]);
  const [wrongSet, setWrongSet] = useState<Set<string>>(new Set());
  const [doneSet, setDoneSet]   = useState<Set<number>>(new Set());
  const [shake, setShake]       = useState(false);

  const word = batch[cardIdx];

  useEffect(() => {
    if (!word) return;
    setPhase("showing");
    setWrongSet(new Set());
    setShake(false);
  }, [cardIdx, batch]);

  useEffect(() => {
    if (phase !== "selecting" || !word) return;
    const pool = batch.filter(w => w.id !== word.id);
    const distractors = shuffle(pool).slice(0, 3).map(w => w.korean);
    setChoices(shuffle([word.korean, ...distractors]));
    setWrongSet(new Set());
  }, [phase, cardIdx, batch]);

  useEffect(() => {
    setCardIdx(0);
    setDoneSet(new Set());
    setPhase("showing");
  }, [batch]);

  function handleChoice(choice: string) {
    if (wrongSet.has(choice)) return;
    if (doneSet.has(cardIdx)) return;

    if (choice === word.korean) {
      const newDone = new Set(doneSet).add(cardIdx);
      setDoneSet(newDone);
      const isLast = cardIdx === batch.length - 1;
      if (isLast && newDone.size === batch.length) {
        setTimeout(onDone, 800);
      } else {
        setTimeout(() => setCardIdx(i => Math.min(i + 1, batch.length - 1)), 700);
      }
    } else {
      setWrongSet(prev => new Set(prev).add(choice));
      setShake(true);
      setTimeout(() => setShake(false), 450);
    }
  }

  if (!word) return null;
  const isDone = doneSet.has(cardIdx);
  const gradeNum = selectedSet?.name.replace("학년", "") ?? "";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#FFF9E6" }}>
      {/* 남색 헤더 */}
      <div style={{ background: "#1F2A44", padding: "14px 20px 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* 학년 심볼 */}
            <div style={{ position: "relative", width: "36px", height: "36px" }}>
              <img src="/TheFluent/logo.symbol.png" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", opacity: 0.5 }} />
              <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", fontWeight: 900, color: "#F6E27F", zIndex: 1 }}>{gradeNum}</span>
            </div>
            <div>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>그룹 {batchIdx + 1}/{totalBatches}</div>
              <div style={{ fontSize: "13px", fontWeight: 800, color: "#F6E27F" }}>
                {phase === "showing" ? "📖 외우기" : "❓ 확인하기"}
              </div>
            </div>
          </div>
          <span style={{ fontSize: "12px", fontWeight: 900, color: "rgba(255,255,255,0.5)" }}>{doneSet.size}/{batch.length}</span>
        </div>
        {/* 진행 점 */}
        <div style={{ display: "flex", gap: "5px", marginTop: "4px" }}>
          {batch.map((_, i) => (
            <div key={i} style={{
              height: "5px", borderRadius: "999px", transition: "all 0.3s",
              width: doneSet.has(i) ? "22px" : i === cardIdx ? "22px" : "8px",
              background: doneSet.has(i) ? "#76C043" : i === cardIdx ? "#F6E27F" : "rgba(255,255,255,0.2)",
            }} />
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center px-5 pt-6 pb-4 gap-5">

        {/* 보기 단계 */}
        {phase === "showing" && (
          <>
            <div className="w-full max-w-sm text-center" style={{ background: "#fff", border: "1.5px solid #F0E8C8", borderRadius: "20px", padding: "32px 24px" }}>
              <p className="text-xs font-black mb-2 uppercase tracking-widest" style={{ color: "#AAAAAA" }}>English</p>
              <p className="text-4xl font-black mb-3" style={{ color: "#1F2A44" }}>{word.english}</p>
              <div style={{ borderTop: "1px solid #F0ECE0", margin: "0 0 14px" }} />
              <p className="text-xs font-black mb-1 uppercase tracking-widest" style={{ color: "#AAAAAA" }}>한국어</p>
              <p className="text-2xl font-black" style={{ color: "#76C043" }}>{word.korean}</p>
              <button onClick={() => speak(word.english)}
                className="mt-5 w-11 h-11 rounded-full inline-flex items-center justify-center text-xl"
                style={{ background: "#FFFBEE" }}>
                🔊
              </button>
            </div>
            <button onClick={() => setPhase("selecting")}
              className="w-full max-w-sm py-4 rounded-2xl font-black text-lg transition-all active:scale-95"
              style={{ background: "#1F2A44", color: "#F6E27F" }}>
              알겠어요! 확인해볼게요 →
            </button>
            <p style={{ color: "#BBBBBB", fontSize: "13px" }}>단어를 잘 기억하고 버튼을 눌러보세요</p>
          </>
        )}

        {/* 선택 단계 */}
        {phase === "selecting" && (
          <>
            <div className={`w-full max-w-sm text-center ${shake ? "shake" : ""}`} style={{ background: "#fff", border: "1.5px solid #F0E8C8", borderRadius: "20px", padding: "28px 24px" }}>
              <p className="text-xs font-black mb-2 uppercase tracking-widest" style={{ color: "#AAAAAA" }}>English</p>
              <p className="text-4xl font-black mb-3" style={{ color: "#1F2A44" }}>{word.english}</p>
              <button onClick={() => speak(word.english)}
                className="w-10 h-10 rounded-full inline-flex items-center justify-center text-lg"
                style={{ background: "#FFFBEE" }}>
                🔊
              </button>
              {isDone && <p className="mt-3 font-black" style={{ color: "#76C043" }}>✅ {word.korean}</p>}
            </div>

            <div className="w-full max-w-sm grid grid-cols-2 gap-3">
              {choices.map(choice => {
                const isCorrectChoice = choice === word.korean;
                const isWrong = wrongSet.has(choice);
                let bg = "#1F2A44";
                let color = "rgba(255,255,255,0.65)";
                if (isDone && isCorrectChoice) { bg = "#76C043"; color = "#fff"; }
                else if (isWrong)              { bg = "rgba(31,42,68,0.3)"; color = "rgba(255,255,255,0.25)"; }
                return (
                  <button key={choice} onClick={() => handleChoice(choice)}
                    disabled={isDone || isWrong}
                    className="rounded-2xl p-4 text-center font-bold text-sm transition-all active:scale-95"
                    style={{ background: bg, color }}>
                    {choice}
                  </button>
                );
              })}
            </div>

            {!isDone && wrongSet.size === 0 && <p style={{ color: "#BBBBBB", fontSize: "13px" }}>한국어 뜻을 골라보세요!</p>}
            {!isDone && wrongSet.size > 0  && <p style={{ color: "#F6A800", fontSize: "13px", fontWeight: 800 }}>다시 골라보세요 💪</p>}
          </>
        )}
      </div>

      <GradeProgressBar batchIdx={batchIdx} totalBatches={totalBatches} />
    </div>
  );
}

export default function ChallengePage() {
  return (
    <Suspense>
      <ChallengePageInner />
    </Suspense>
  );
}
