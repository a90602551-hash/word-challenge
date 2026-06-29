"use client";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = "en-US";
  utt.rate = 0.9;
  window.speechSynthesis.speak(utt);
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

function ChallengePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [wordSets, setWordSets]       = useState<WordSet[]>([]);
  const [progressMap, setProgressMap] = useState<Record<number, number>>({});  // wordSetId → batchIdx
  const [allWords, setAllWords]       = useState<Word[]>([]);
  const [batches, setBatches]       = useState<Word[][]>([]);
  const [selectedSet, setSelectedSet] = useState<WordSet | null>(null);
  const [screen, setScreen]         = useState<Screen>("select-set");
  const [batchIdx, setBatchIdx]     = useState(0);
  const [quizIdx, setQuizIdx]       = useState(0);
  const [choices, setChoices]       = useState<string[]>([]);
  const [selected, setSelected]     = useState<string | null>(null);
  const [isCorrect, setIsCorrect]   = useState<boolean | null>(null);
  const [typed, setTyped]           = useState("");
  const [totalScore, setTotalScore]     = useState(0);
  const [batchScore, setBatchScore]     = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [stageCorrect, setStageCorrect] = useState(0);  // 현재 단계 정답 수
  const [stageFailed, setStageFailed]   = useState<Screen | null>(null); // 실패한 단계
  const [animKey, setAnimKey]       = useState(0);
  const [copyRound, setCopyRound]   = useState(1);  // 1~3
  const [copyIdx, setCopyIdx]       = useState(0);
  const [copyTyped, setCopyTyped]   = useState("");
  const [copyOk, setCopyOk]         = useState<boolean | null>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const copyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => {
        if (!r.ok) { router.push("/"); return; }
        // startSet 파라미터가 있으면 배치테스트에서 온 것 → 체크 생략
        if (searchParams.get("startSet")) return;
        // 첫 방문자면 레벨 테스트로 이동
        return fetch("/api/challenge/score/me")
          .then(r2 => r2.json())
          .then(d => { if (d?.isFirst) router.push("/placement"); })
          .catch(() => {});
      })
      .catch(() => router.push("/"));
    fetch("/api/wordsets").then(r => r.json()).then((sets: WordSet[]) => {
      setWordSets(sets);
      // 배치 테스트에서 추천 학년으로 왔으면 자동 선택
      const startSetId = Number(searchParams.get("startSet"));
      if (startSetId) {
        const target = sets.find(ws => ws.id === startSetId);
        if (target) setTimeout(() => selectSet(target), 100);
      }
      // 각 학년의 진도 조회
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
      // 저장된 순서에 없는 새 단어는 뒤에 추가
      const missing = words.filter(w => !ids.includes(w.id));
      ordered = [...restored, ...missing];
      startBatch = progress.batchIdx ?? 0;
    } else {
      ordered = shuffle(words);
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

    // 진도 없으면 초기 저장
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
      // 단계 끝 → 90% 통과 여부 계산 (마지막 문제 포함)
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
        // 같은 단어 다음 회차
        setCopyRound(nextRound);
      } else {
        // 이 단어 3번 완료 → 다음 단어
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
      // 완료 → 진도 삭제
      fetch(`/api/progress?wordSetId=${selectedSet?.id}`, { method: "DELETE" }).catch(() => {});
      // 완료 시 다음 학년 잠금 해제
      if (typeof window !== "undefined" && localStorage.getItem("wc_placed_id")) {
        const curIdx = wordSets.findIndex(ws => ws.id === selectedSet?.id);
        const curUnlocked = Number(localStorage.getItem("wc_unlocked_idx") ?? curIdx);
        if (curIdx >= 0 && curIdx >= curUnlocked) {
          const nextIdx = curIdx + 1;
          if (nextIdx < wordSets.length) {
            localStorage.setItem("wc_unlocked_idx", String(nextIdx));
          } else {
            // 전체 완료 → 잠금 전부 해제
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
      // 다음 배치 진도 저장
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

  // ── 단어장 선택 ──
  if (screen === "select-set") {
    // startSet 파라미터가 있으면 로딩 중 (자동 선택 대기)
    if (searchParams.get("startSet")) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 flex items-center justify-center">
          <p className="text-white text-xl font-bold animate-pulse">학습 준비 중... ✨</p>
        </div>
      );
    }
    const placedId      = typeof window !== "undefined" ? Number(localStorage.getItem("wc_placed_id") || 0) : 0;
    const unlockedIdx   = typeof window !== "undefined" ? Number(localStorage.getItem("wc_unlocked_idx") ?? -1) : -1;
    const placedSet     = placedId ? wordSets.find(ws => ws.id === placedId) : null;
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 px-4 py-8">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-extrabold text-white">📚 학년 선택</h1>
            <button onClick={handleLogout} className="text-white/60 hover:text-white text-sm">로그아웃</button>
          </div>
          {placedSet ? (
            <div className="bg-white/20 rounded-2xl px-4 py-3 mb-5 text-white text-sm">
              🎯 레벨 테스트 결과 <span className="font-extrabold">{placedSet.emoji} {placedSet.name}</span>이 추천됐어요!<br />
              <span className="text-purple-200 text-xs">추천 학년을 완료하면 다른 학년도 도전할 수 있어요 💪</span>
            </div>
          ) : (
            <p className="text-purple-200 text-sm mb-5">학년을 선택하면 5개씩 묶어서 외우고 테스트해요!</p>
          )}
          <div className="grid grid-cols-2 gap-4">
            {wordSets.map(ws => {
              const savedBatch = progressMap[ws.id];
              const totalGroups = Math.ceil(ws._count.words / BATCH_SIZE);
              const wsIdx    = wordSets.findIndex(w => w.id === ws.id);
              const isLocked = placedId > 0 && wsIdx > unlockedIdx;
              return isLocked ? (
                <div key={ws.id} className="bg-white/30 rounded-2xl p-5 text-left relative opacity-50 cursor-not-allowed">
                  <span className="absolute top-3 right-3 text-lg">🔒</span>
                  <p className="text-4xl mb-2 grayscale">{ws.emoji}</p>
                  <p className="font-extrabold text-white text-lg">{ws.name}</p>
                  <p className="text-xs text-white/60 mt-1">{ws._count.words}개 단어</p>
                  <p className="text-xs text-white/50 mt-1">추천 학년 완료 후 해제</p>
                </div>
              ) : (
                <button key={ws.id} onClick={() => selectSet(ws)}
                  className="bg-white rounded-2xl p-5 text-left shadow-lg hover:scale-105 active:scale-95 transition-transform relative">
                  {placedId > 0 && wsIdx === unlockedIdx && (
                    <span className="absolute top-3 right-3 bg-amber-400 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {wsIdx === wordSets.findIndex(w => w.id === placedId) ? "추천!" : "🔓 새로 해제!"}
                    </span>
                  )}
                  {savedBatch > 0 && placedId === 0 && (
                    <span className="absolute top-3 right-3 bg-violet-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      이어하기
                    </span>
                  )}
                  <p className="text-4xl mb-2">{ws.emoji}</p>
                  <p className="font-extrabold text-gray-800 text-lg">{ws.name}</p>
                  <p className="text-xs text-gray-400 mt-1">{ws._count.words}개 단어</p>
                  {savedBatch > 0 ? (
                    <p className="text-xs text-violet-500 mt-1 font-bold">
                      {savedBatch}/{totalGroups} 그룹 완료
                    </p>
                  ) : (
                    <p className="text-xs text-purple-400 mt-1 font-bold">
                      {totalGroups}그룹 × 5단어
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const totalBatches = batches.length;
  const progressPct = totalBatches > 0 ? Math.round((batchIdx / totalBatches) * 100) : 0;

  // ── 외우기 (플래시카드) ──
  if (screen === "study") {
    return <FlashCards
      batch={currentBatch}
      batchIdx={batchIdx}
      totalBatches={totalBatches}
      progressPct={progressPct}
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
      <div className="min-h-screen bg-gradient-to-b from-emerald-500 to-teal-600 flex flex-col">
        <div className="px-4 py-4 flex items-center gap-3">
          <div className="w-6" />
          <div className="flex-1 text-center">
            <p className="text-white/70 text-xs">그룹 {batchIdx + 1}/{totalBatches} · 따라쓰기</p>
            <p className="text-white font-bold text-sm">⌨️ 보고 따라쓰기 {copyRound}/{COPY_ROUNDS}회</p>
          </div>
          <span className="text-white/60 text-sm">{copyIdx + 1}/{currentBatch.length}</span>
        </div>

        <div className="h-2 bg-white/20">
          <div className="h-full bg-white/70 transition-all duration-500 rounded-r-full" style={{ width: `${copyProgress}%` }} />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-5 gap-5">
          {/* 단어 카드 - 영어+한국어 동시 표시 */}
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-7 text-center">
            <p className="text-xs text-gray-400 mb-1 font-bold tracking-widest uppercase">따라 써보세요</p>
            <p className="text-4xl font-extrabold text-gray-800 mb-1">{cq.english}</p>
            <p className="text-lg text-emerald-500 font-bold">{cq.korean}</p>
            <button onClick={() => speak(cq.english)} className="mt-3 w-10 h-10 rounded-full bg-emerald-100 hover:bg-emerald-200 inline-flex items-center justify-center text-lg transition-all">
              🔊
            </button>
          </div>

          {/* 입력 */}
          <form onSubmit={handleCopySubmit} className="w-full max-w-sm space-y-3">
            <input
              ref={copyInputRef}
              type="text"
              value={copyTyped}
              onChange={e => { setCopyTyped(e.target.value); setCopyOk(null); }}
              disabled={copyOk === true}
              placeholder={cq.english.replace(/./g, "_ ")}
              autoComplete="off" autoCorrect="off" spellCheck={false}
              className={`w-full border-2 rounded-2xl px-5 py-4 text-xl text-center font-bold outline-none transition-all
                ${copyOk === true ? "border-emerald-400 bg-emerald-50 text-emerald-600" :
                  copyOk === false ? "border-red-400 bg-red-50 animate-shake" :
                  "border-white/50 bg-white focus:border-emerald-300"}`}
            />
            {copyOk === true  && <p className="text-center text-emerald-600 font-extrabold">✅ 잘했어요!</p>}
            {copyOk === false && <p className="text-center text-red-500 font-bold text-sm">❌ 다시 입력해보세요</p>}
            {copyOk === null && (
              <button type="submit" disabled={!copyTyped.trim()}
                className="w-full py-4 rounded-2xl text-white font-extrabold text-lg bg-white/20 hover:bg-white/30 disabled:opacity-40 transition-all">
                확인 ✓
              </button>
            )}
          </form>
        </div>

        <StepBar currentStep={3} />
        <style>{`
          @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(6px)} }
          .animate-shake { animation: shake 0.45s ease; }
        `}</style>
      </div>
    );
  }

  // ── 단계 실패 ──
  if (screen === "stage-fail") {
    const stageLabel = stageFailed === "quiz-mtw" ? "뜻 보고 단어 고르기" : "단어 보고 뜻 고르기";
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-400 to-orange-500 flex flex-col items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm text-center">
          <div className="text-6xl mb-3">😅</div>
          <h2 className="text-2xl font-extrabold text-gray-800 mb-1">아직 부족해요!</h2>
          <p className="text-gray-500 text-sm mb-2">
            <span className="font-bold text-red-400">"{stageLabel}"</span> 단계를<br/>90% 이상 맞춰야 다음으로 갈 수 있어요
          </p>
          <p className="text-gray-400 text-xs mb-6">단어를 다시 외우고 도전해보세요 💪</p>
          <button
            onClick={() => { setScreen("study"); setAnimKey(k => k + 1); }}
            className="w-full py-4 rounded-2xl text-white font-extrabold text-lg bg-gradient-to-r from-violet-500 to-indigo-500 shadow-lg">
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
      <div className="min-h-screen bg-gradient-to-br from-violet-500 to-indigo-600 flex flex-col items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm text-center bounce-in">
          <div className="text-6xl mb-2">{emoji}</div>
          <h2 className="text-2xl font-extrabold text-gray-800 mb-1">{msg}</h2>
          <p className="text-gray-400 text-sm mb-5">그룹 {batchIdx + 1} · 정확도 {pct}%</p>

          <div className="flex justify-center gap-4 mb-5">
            <div className="bg-violet-50 rounded-2xl px-5 py-4">
              <p className="text-3xl font-extrabold text-violet-600">{batchScore}<span className="text-lg">/{batchTotal}</span></p>
              <p className="text-xs text-gray-400 mt-1">정답</p>
            </div>
            <div className={`rounded-2xl px-5 py-4 ${passed ? "bg-green-50" : "bg-red-50"}`}>
              <p className={`text-3xl font-extrabold ${passed ? "text-green-500" : "text-red-400"}`}>{pct}%</p>
              <p className="text-xs text-gray-400 mt-1">정확도</p>
            </div>
          </div>

          {/* 진행 바 */}
          <div className="h-2.5 bg-gray-100 rounded-full mb-2">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: passed ? "#22c55e" : "#f87171" }} />
          </div>
          <p className="text-xs text-gray-400 mb-6">
            {passed ? "✅ 90% 이상 달성!" : "⚠️ 다음 단계로 가려면 90% 이상이어야 해요"}
          </p>

          <div className="space-y-3">
            {passed ? (
              <button onClick={nextBatch}
                className="w-full py-4 rounded-2xl text-white font-extrabold text-lg bg-gradient-to-r from-violet-500 to-indigo-500 shadow-lg">
                {isLast ? "🎊 전체 완료!" : `다음 그룹 (${batchIdx + 2}/${totalBatches}) →`}
              </button>
            ) : (
              <button onClick={() => { setScreen("study"); setAnimKey(k => k + 1); }}
                className="w-full py-4 rounded-2xl text-white font-extrabold text-lg bg-gradient-to-r from-red-400 to-orange-400 shadow-lg">
                📖 카드부터 다시 외우기!
              </button>
            )}
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
        <div className="w-6" />
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

      {/* 하단 단계 진행바 */}
      <StepBar currentStep={isMTW ? 1 : isWTM ? 2 : 4} />
    </div>
  );
}

// ── 플래시카드 컴포넌트 (보기 → 선택 두 단계) ──
function FlashCards({ batch, batchIdx, totalBatches, selectedSet, onExit, onDone }: {
  batch: Word[];
  batchIdx: number;
  totalBatches: number;
  progressPct?: number;
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

  // 카드 바뀔 때: 보기 단계부터 시작, 발음 재생
  useEffect(() => {
    if (!word) return;
    setPhase("showing");
    setWrongSet(new Set());
    setShake(false);
    setTimeout(() => speak(word.english), 150);
  }, [cardIdx, batch]);

  // 선택 단계 진입 시 보기 생성
  useEffect(() => {
    if (phase !== "selecting" || !word) return;
    const pool = batch.filter(w => w.id !== word.id);
    const distractors = shuffle(pool).slice(0, 3).map(w => w.korean);
    setChoices(shuffle([word.korean, ...distractors]));
    setWrongSet(new Set());
  }, [phase, cardIdx, batch]);

  // 처음 마운트 시 리셋
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-600 to-indigo-700 flex flex-col">
      {/* 상단 */}
      <div className="px-4 py-4 flex items-center gap-3">
        <div className="w-6" />
        <div className="flex-1 text-center">
          <p className="text-white/70 text-xs">{selectedSet?.emoji} {selectedSet?.name} · 그룹 {batchIdx + 1}/{totalBatches}</p>
          <p className="text-white font-bold text-sm">
            {phase === "showing" ? "📖 외우기" : "❓ 확인하기"}
          </p>
        </div>
        <span className="text-white/60 text-sm">{doneSet.size}/{batch.length}</span>
      </div>

      {/* 진행 점 */}
      <div className="flex justify-center gap-2 mb-5">
        {batch.map((_, i) => (
          <div key={i} className={`h-2.5 rounded-full transition-all duration-300 ${
            doneSet.has(i) ? "w-7 bg-green-400" :
            i === cardIdx ? "w-7 bg-white" :
            "w-2.5 bg-white/25"
          }`} />
        ))}
      </div>

      <div className="flex-1 flex flex-col items-center px-5 pt-2 pb-6 gap-5">

        {/* ── 보기 단계: 영어 + 한국어 함께 표시 ── */}
        {phase === "showing" && (
          <>
            <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 text-center">
              <p className="text-xs text-gray-400 mb-2 font-bold tracking-widest uppercase">English</p>
              <p className="text-4xl font-extrabold text-gray-800">{word.english}</p>
              <div className="my-4 border-t border-gray-100" />
              <p className="text-xs text-gray-400 mb-1 font-bold tracking-widest uppercase">한국어</p>
              <p className="text-2xl font-extrabold text-violet-600">{word.korean}</p>
              <button onClick={() => speak(word.english)}
                className="mt-5 w-11 h-11 rounded-full bg-violet-100 hover:bg-violet-200 inline-flex items-center justify-center text-xl transition-all">
                🔊
              </button>
            </div>
            <button onClick={() => setPhase("selecting")}
              className="w-full max-w-sm py-4 rounded-2xl bg-white text-violet-600 font-extrabold text-lg shadow-lg active:scale-95 transition-all">
              알겠어요! 확인해볼게요 →
            </button>
            <p className="text-white/40 text-sm">단어를 잘 기억하고 버튼을 눌러보세요</p>
          </>
        )}

        {/* ── 선택 단계: 영어만 보이고 한국어 4지선다 ── */}
        {phase === "selecting" && (
          <>
            <div className={`w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 text-center ${shake ? "animate-shake" : ""}`}>
              <p className="text-xs text-gray-400 mb-2 font-bold tracking-widest uppercase">English</p>
              <p className="text-4xl font-extrabold text-gray-800 mb-3">{word.english}</p>
              <button onClick={() => speak(word.english)}
                className="w-10 h-10 rounded-full bg-violet-100 hover:bg-violet-200 inline-flex items-center justify-center text-lg transition-all">
                🔊
              </button>
              {isDone && <p className="mt-3 text-green-500 font-extrabold text-lg">✅ {word.korean}</p>}
            </div>

            <div className="w-full max-w-sm grid grid-cols-2 gap-3">
              {choices.map(choice => {
                const isCorrectChoice = choice === word.korean;
                const isWrong = wrongSet.has(choice);
                let cls = "bg-white/90 text-gray-800 border-2 border-white/30 hover:bg-white active:scale-95";
                if (isDone && isCorrectChoice) cls = "bg-green-400 text-white border-2 border-green-300 scale-105";
                else if (isWrong)             cls = "bg-white/20 text-white/30 border-2 border-white/10 line-through";
                return (
                  <button key={choice} onClick={() => handleChoice(choice)}
                    disabled={isDone || isWrong}
                    className={`rounded-2xl p-4 text-center font-bold text-base transition-all duration-200 shadow-md ${cls}`}>
                    {choice}
                  </button>
                );
              })}
            </div>

            {!isDone && wrongSet.size === 0 && <p className="text-white/50 text-sm">한국어 뜻을 골라보세요!</p>}
            {!isDone && wrongSet.size > 0  && <p className="text-yellow-300 text-sm font-bold">다시 골라보세요 💪</p>}
          </>
        )}
      </div>

      {/* 하단 단계 진행바 */}
      <StepBar currentStep={0} dark />

      <style>{`
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(6px)} }
        .animate-shake { animation: shake 0.45s ease; }
      `}</style>
    </div>
  );
}

// currentStep: 0=외우기, 1=뜻→단어, 2=단어→뜻, 3=따라쓰기, 4=타이핑
function StepBar({ currentStep, dark }: { currentStep: number; dark?: boolean }) {
  const steps = [
    { label: "외우기", icon: "📖" },
    { label: "뜻→단어", icon: "❓" },
    { label: "단어→뜻", icon: "❓" },
    { label: "따라쓰기", icon: "✏️" },
    { label: "타이핑", icon: "⌨️" },
  ];
  return (
    <div className="px-4 pb-5 pt-3">
      <div className="max-w-sm mx-auto flex gap-1">
        {steps.map((s, i) => {
          const done    = i < currentStep;
          const current = i === currentStep;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className={`h-2 w-full rounded-full transition-all duration-300 ${
                done    ? (dark ? "bg-white/80" : "bg-violet-400") :
                current ? (dark ? "bg-white" : "bg-violet-600") :
                          (dark ? "bg-white/20" : "bg-gray-200")
              }`} />
              <span className={`text-[9px] font-bold leading-none ${
                done    ? (dark ? "text-white/70" : "text-violet-400") :
                current ? (dark ? "text-white" : "text-violet-700") :
                          (dark ? "text-white/25" : "text-gray-300")
              }`}>{s.icon} {s.label}</span>
            </div>
          );
        })}
      </div>
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
