"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";

interface Student  { id: number; name: string; username: string; avatar: string; approved: boolean; createdAt: string; }
interface WordSet   { id: number; name: string; emoji: string; description: string; _count: { words: number }; }
interface Word      { id: number; english: string; korean: string; }
interface ScoreRow  { id: number; studentId: number; wordSetId: number | null; score: number; totalQuestions: number; createdAt: string; }
interface ProgressRow { studentId: number; wordSetId: number; batchIdx: number; }

const AVATARS = ["🐥", "🐶", "🐱", "🐰", "🐻", "🦊", "🐸", "🐧", "🦄", "🐯", "🐼", "🐨"];
type Tab = "pending" | "students" | "words" | "results";

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab]               = useState<Tab>("pending");
  const [students, setStudents]     = useState<Student[]>([]);
  const [wordSets, setWordSets]     = useState<WordSet[]>([]);
  const [scores, setScores]         = useState<ScoreRow[]>([]);
  const [progresses, setProgresses] = useState<ProgressRow[]>([]);
  const [resultsWordSets, setResultsWordSets] = useState<WordSet[]>([]);
  const [selectedWs, setSelectedWs] = useState<WordSet | null>(null);
  const [wsWords, setWsWords]       = useState<Word[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // 학생 추가 폼
  const [sName, setSName]       = useState("");
  const [sUsername, setSUsername] = useState("");
  const [sPassword, setSPassword] = useState("");
  const [sAvatar, setSAvatar]   = useState("🐥");
  const [sError, setSError]     = useState("");

  // 단어장 추가 폼
  const [wsName, setWsName]   = useState("");
  const [wsEmoji, setWsEmoji] = useState("📚");
  const [wsError, setWsError] = useState("");

  // 단어 추가 폼
  const [wEng, setWEng] = useState("");
  const [wKor, setWKor] = useState("");
  const [wError, setWError] = useState("");

  // 비밀번호 변경
  const [pwStudentId, setPwStudentId] = useState<number | null>(null);
  const [newPw, setNewPw]             = useState("");

  useEffect(() => {
    fetch("/api/teacher/me").then(r => { if (!r.ok) router.push("/admin/login"); }).catch(() => router.push("/admin/login"));
    loadStudents();
    loadWordSets();
    loadResults();
  }, []);

  async function loadStudents() {
    const r = await fetch("/api/students");
    if (r.ok) setStudents(await r.json());
  }
  async function loadWordSets() {
    const r = await fetch("/api/wordsets");
    if (r.ok) setWordSets(await r.json());
  }
  async function loadResults() {
    const r = await fetch("/api/teacher/scores");
    if (r.ok) {
      const data = await r.json();
      setScores(data.scores);
      setProgresses(data.progresses);
      setResultsWordSets(data.wordSets);
    }
  }
  async function loadWords(ws: WordSet) {
    const r = await fetch(`/api/wordsets/${ws.id}/words`);
    if (r.ok) setWsWords(await r.json());
  }

  async function addStudent(e: React.FormEvent) {
    e.preventDefault(); setSError("");
    const res = await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: sName, username: sUsername, password: sPassword, avatar: sAvatar }),
    });
    const data = await res.json();
    if (!res.ok) { setSError(data.error); return; }
    setSName(""); setSUsername(""); setSPassword(""); setSAvatar("🐥");
    loadStudents();
  }

  async function approveStudent(id: number, approved: boolean) {
    await fetch(`/api/students/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved }),
    });
    loadStudents();
  }

  async function deleteStudent(id: number) {
    if (!confirm("정말 삭제할까요?")) return;
    await fetch(`/api/students/${id}`, { method: "DELETE" });
    loadStudents();
  }

  async function changePassword(id: number) {
    if (!newPw.trim()) return;
    const res = await fetch(`/api/students/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPw }),
    });
    if (res.ok) { setPwStudentId(null); setNewPw(""); alert("비밀번호가 변경되었어요!"); }
  }

  async function handleExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<{ 이름: string; 아이디: string; 비밀번호: string | number; 아바타?: string }>(ws);
    const students = rows.map(r => ({
      name: String(r["이름"] || ""),
      username: String(r["아이디"] || ""),
      password: String(r["비밀번호"] || ""),
      avatar: r["아바타"] || "🐥",
    })).filter(s => s.name && s.username && s.password);

    if (students.length === 0) { alert("엑셀에 데이터가 없어요. 열 이름: 이름, 아이디, 비밀번호"); return; }

    const res = await fetch("/api/students/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ students }),
    });
    const data = await res.json();
    alert(`✅ ${data.created}명 등록, ${data.skipped}명 건너뜀${data.errors?.length ? `\n오류: ${data.errors.join(", ")}` : ""}`);
    loadStudents();
    if (fileRef.current) fileRef.current.value = "";
  }

  function downloadTemplate() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["이름", "아이디", "비밀번호", "아바타"],
      ["홍길동", "hong123", "1234", "🐶"],
      ["김철수", "kim456", "5678", "🐱"],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "학생목록");
    XLSX.writeFile(wb, "학생등록_템플릿.xlsx");
  }

  async function addWordSet(e: React.FormEvent) {
    e.preventDefault(); setWsError("");
    const res = await fetch("/api/wordsets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: wsName, emoji: wsEmoji }),
    });
    const data = await res.json();
    if (!res.ok) { setWsError(data.error); return; }
    setWsName(""); setWsEmoji("📚");
    loadWordSets();
  }

  async function deleteWordSet(id: number) {
    if (!confirm("단어장과 모든 단어가 삭제됩니다. 삭제할까요?")) return;
    await fetch(`/api/wordsets/${id}`, { method: "DELETE" });
    if (selectedWs?.id === id) setSelectedWs(null);
    loadWordSets();
  }

  async function addWord(e: React.FormEvent) {
    e.preventDefault(); setWError("");
    if (!selectedWs) return;
    const res = await fetch(`/api/wordsets/${selectedWs.id}/words`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ english: wEng.trim(), korean: wKor.trim() }),
    });
    const data = await res.json();
    if (!res.ok) { setWError(data.error); return; }
    setWEng(""); setWKor("");
    loadWords(selectedWs);
    loadWordSets();
  }

  async function deleteWord(wordId: number) {
    if (!selectedWs) return;
    await fetch(`/api/wordsets/${selectedWs.id}/words/${wordId}`, { method: "DELETE" });
    loadWords(selectedWs);
    loadWordSets();
  }

  async function handleLogout() {
    await fetch("/api/teacher/logout", { method: "POST" });
    router.push("/admin/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-slate-800 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">👨‍🏫</span>
          <h1 className="text-xl font-extrabold">단어 챌린지 관리</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/")} className="text-slate-300 hover:text-white text-sm">학생 홈 보기</button>
          <button onClick={handleLogout} className="text-slate-400 hover:text-white text-sm">로그아웃</button>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex border-b bg-white px-6 gap-6">
        {(["pending", "students", "words", "results"] as Tab[]).map(t => {
          const pendingCount = students.filter(s => !s.approved).length;
          return (
            <button key={t} onClick={() => { setTab(t); if (t === "results") loadResults(); }}
              className={`py-3 font-bold text-sm transition-all border-b-2 relative ${tab === t ? "border-slate-700 text-slate-800" : "border-transparent text-gray-400"}`}>
              {t === "pending" ? "⏳ 승인 대기" : t === "students" ? "👥 학생 관리" : t === "words" ? "📚 단어장 관리" : "📊 학습 결과"}
              {t === "pending" && pendingCount > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-xs font-extrabold px-1.5 py-0.5 rounded-full">{pendingCount}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* ── 승인 대기 ── */}
        {tab === "pending" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b flex items-center justify-between">
                <h2 className="font-extrabold text-gray-800">⏳ 가입 승인 대기</h2>
                <span className="text-sm text-gray-400">승인해야 학생이 앱을 이용할 수 있어요</span>
              </div>
              {students.filter(s => !s.approved).length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-4xl mb-2">✅</div>
                  <p>대기 중인 학생이 없어요!</p>
                </div>
              ) : (
                <div className="divide-y">
                  {students.filter(s => !s.approved).map(s => (
                    <div key={s.id} className="px-5 py-4 flex items-center gap-3">
                      <span className="text-2xl">{s.avatar}</span>
                      <div className="flex-1">
                        <p className="font-bold text-gray-800">{s.name}</p>
                        <p className="text-xs text-gray-400">아이디: {s.username} · 가입일: {new Date(s.createdAt).toLocaleDateString("ko-KR")}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => approveStudent(s.id, true)}
                          className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-600">
                          ✅ 승인
                        </button>
                        <button onClick={() => deleteStudent(s.id)}
                          className="bg-red-100 text-red-500 px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-200">
                          ❌ 거절
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 학생 관리 ── */}
        {tab === "students" && (
          <div className="space-y-6">
            {/* 학생 추가 폼 */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="font-extrabold text-gray-800 mb-4">➕ 학생 추가</h2>
              <form onSubmit={addStudent} className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <input value={sName} onChange={e => setSName(e.target.value)} placeholder="이름" required
                  className="border rounded-xl px-3 py-2 text-sm outline-none focus:border-slate-400" />
                <input value={sUsername} onChange={e => setSUsername(e.target.value)} placeholder="아이디" required
                  className="border rounded-xl px-3 py-2 text-sm outline-none focus:border-slate-400" />
                <input value={sPassword} onChange={e => setSPassword(e.target.value)} placeholder="비밀번호" required
                  className="border rounded-xl px-3 py-2 text-sm outline-none focus:border-slate-400" />
                <div className="flex gap-2">
                  <select value={sAvatar} onChange={e => setSAvatar(e.target.value)}
                    className="border rounded-xl px-2 py-2 text-lg outline-none focus:border-slate-400">
                    {AVATARS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <button type="submit" className="flex-1 bg-slate-700 text-white rounded-xl font-bold text-sm hover:bg-slate-800">추가</button>
                </div>
              </form>
              {sError && <p className="text-red-500 text-sm mt-2">{sError}</p>}
            </div>

            {/* 엑셀 일괄 등록 */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-extrabold text-gray-800">📊 엑셀로 일괄 등록</h2>
                <button onClick={downloadTemplate} className="text-sm text-blue-600 hover:underline">템플릿 다운로드</button>
              </div>
              <p className="text-xs text-gray-400 mb-3">열 이름: 이름, 아이디, 비밀번호, 아바타(선택)</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleExcelUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-slate-100 file:text-slate-700 file:font-bold hover:file:bg-slate-200 cursor-pointer" />
            </div>

            {/* 학생 목록 */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b">
                <h2 className="font-extrabold text-gray-800">👥 학생 목록 ({students.length}명)</h2>
              </div>
              {students.length === 0 ? (
                <div className="text-center py-12 text-gray-400">아직 학생이 없어요</div>
              ) : (
                <div className="divide-y">
                  {students.map(s => (
                    <div key={s.id} className="px-5 py-3 flex items-center gap-3">
                      <span className="text-2xl">{s.avatar}</span>
                      <div className="flex-1">
                        <p className="font-bold text-gray-800">{s.name}
                          {!s.approved && <span className="ml-2 text-xs bg-amber-100 text-amber-600 font-bold px-2 py-0.5 rounded-full">미승인</span>}
                        </p>
                        <p className="text-xs text-gray-400">아이디: {s.username}</p>
                      </div>
                      {pwStudentId === s.id ? (
                        <div className="flex gap-2 items-center">
                          <input value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="새 비밀번호"
                            className="border rounded-lg px-3 py-1.5 text-sm outline-none w-32" />
                          <button onClick={() => changePassword(s.id)} className="bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold">변경</button>
                          <button onClick={() => setPwStudentId(null)} className="text-gray-400 text-sm">취소</button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={() => { setPwStudentId(s.id); setNewPw(""); }}
                            className="text-xs text-blue-500 hover:underline">비밀번호 변경</button>
                          <button onClick={() => deleteStudent(s.id)} className="text-xs text-red-400 hover:underline">삭제</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 단어장 관리 ── */}
        {tab === "words" && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* 왼쪽: 단어장 목록 */}
            <div className="space-y-4">
              {/* 단어장 추가 */}
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <h2 className="font-extrabold text-gray-800 mb-3">➕ 단어장 추가</h2>
                <form onSubmit={addWordSet} className="flex gap-2">
                  <input value={wsEmoji} onChange={e => setWsEmoji(e.target.value)} placeholder="📚"
                    className="border rounded-xl px-3 py-2 text-lg w-16 text-center outline-none" />
                  <input value={wsName} onChange={e => setWsName(e.target.value)} placeholder="단어장 이름" required
                    className="border rounded-xl px-3 py-2 text-sm flex-1 outline-none focus:border-slate-400" />
                  <button type="submit" className="bg-slate-700 text-white rounded-xl px-4 font-bold text-sm hover:bg-slate-800">추가</button>
                </form>
                {wsError && <p className="text-red-500 text-sm mt-2">{wsError}</p>}
              </div>

              {/* 단어장 목록 */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b">
                  <h2 className="font-extrabold text-gray-800">📚 단어장 목록</h2>
                </div>
                {wordSets.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">단어장이 없어요</div>
                ) : (
                  <div className="divide-y">
                    {wordSets.map(ws => (
                      <div key={ws.id}
                        className={`px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors ${selectedWs?.id === ws.id ? "bg-slate-50" : "hover:bg-gray-50"}`}
                        onClick={() => { setSelectedWs(ws); loadWords(ws); }}>
                        <span className="text-xl">{ws.emoji}</span>
                        <div className="flex-1">
                          <p className="font-bold text-gray-800 text-sm">{ws.name}</p>
                          <p className="text-xs text-gray-400">{ws._count.words}개 단어</p>
                        </div>
                        <button onClick={e => { e.stopPropagation(); deleteWordSet(ws.id); }}
                          className="text-xs text-red-400 hover:underline">삭제</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 오른쪽: 선택된 단어장의 단어 */}
            <div className="space-y-4">
              {selectedWs ? (
                <>
                  <div className="bg-white rounded-2xl shadow-sm p-5">
                    <h2 className="font-extrabold text-gray-800 mb-3">{selectedWs.emoji} {selectedWs.name} — 단어 추가</h2>
                    <form onSubmit={addWord} className="flex gap-2">
                      <input value={wEng} onChange={e => setWEng(e.target.value)} placeholder="English" required
                        className="border rounded-xl px-3 py-2 text-sm flex-1 outline-none focus:border-slate-400" />
                      <input value={wKor} onChange={e => setWKor(e.target.value)} placeholder="한국어 뜻" required
                        className="border rounded-xl px-3 py-2 text-sm flex-1 outline-none focus:border-slate-400" />
                      <button type="submit" className="bg-slate-700 text-white rounded-xl px-4 font-bold text-sm hover:bg-slate-800">추가</button>
                    </form>
                    {wError && <p className="text-red-500 text-sm mt-2">{wError}</p>}
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b">
                      <h2 className="font-extrabold text-gray-800 text-sm">{wsWords.length}개 단어</h2>
                    </div>
                    {wsWords.length === 0 ? (
                      <div className="text-center py-8 text-gray-400 text-sm">단어를 추가해주세요</div>
                    ) : (
                      <div className="divide-y max-h-96 overflow-y-auto">
                        {wsWords.map(w => (
                          <div key={w.id} className="px-4 py-2.5 flex items-center gap-3">
                            <p className="font-bold text-gray-800 text-sm w-28">{w.english}</p>
                            <p className="text-gray-500 text-sm flex-1">{w.korean}</p>
                            <button onClick={() => deleteWord(w.id)} className="text-xs text-red-400 hover:underline">삭제</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-400">
                  <p className="text-4xl mb-3">👈</p>
                  <p className="font-bold">단어장을 선택하면<br />단어를 추가할 수 있어요</p>
                </div>
              )}
            </div>
          </div>
        )}
        {/* ── 학습 결과 ── */}
        {tab === "results" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b flex items-center justify-between">
                <h2 className="font-extrabold text-gray-800">📊 학생별 학습 결과</h2>
                <button onClick={loadResults} className="text-xs text-slate-500 hover:text-slate-800">🔄 새로고침</button>
              </div>
              {students.length === 0 ? (
                <div className="text-center py-12 text-gray-400">학생이 없어요</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="px-4 py-3 text-left font-bold text-gray-600">학생</th>
                        {resultsWordSets.map(ws => (
                          <th key={ws.id} className="px-4 py-3 text-center font-bold text-gray-600 whitespace-nowrap">
                            {ws.emoji} {ws.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {students.map(s => (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{s.avatar}</span>
                              <div>
                                <p className="font-bold text-gray-800">{s.name}</p>
                                <p className="text-xs text-gray-400">{s.username}</p>
                              </div>
                            </div>
                          </td>
                          {resultsWordSets.map(ws => {
                            const wsScores = scores.filter(sc => sc.studentId === s.id && sc.wordSetId === ws.id);
                            const progress = progresses.find(p => p.studentId === s.id && p.wordSetId === ws.id);
                            const totalGroups = Math.ceil(ws._count.words / 5);

                            if (wsScores.length === 0 && !progress) {
                              return <td key={ws.id} className="px-4 py-3 text-center text-gray-300 text-xs">미시작</td>;
                            }

                            const best = wsScores.reduce((max, sc) => {
                              const pct = sc.totalQuestions > 0 ? Math.round(sc.score / sc.totalQuestions * 100) : 0;
                              return pct > max ? pct : max;
                            }, 0);
                            const latest = wsScores[0];
                            const latestPct = latest && latest.totalQuestions > 0
                              ? Math.round(latest.score / latest.totalQuestions * 100) : null;
                            const completedGroups = progress?.batchIdx ?? (wsScores.length > 0 ? totalGroups : 0);
                            const isComplete = !progress && wsScores.length > 0;

                            return (
                              <td key={ws.id} className="px-4 py-3 text-center">
                                {isComplete ? (
                                  <div>
                                    <span className="inline-block bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full mb-1">완료 ✅</span>
                                    {latestPct !== null && <p className="text-xs text-gray-500">최근 {latestPct}%</p>}
                                  </div>
                                ) : (
                                  <div>
                                    <span className="inline-block bg-blue-100 text-blue-600 text-xs font-bold px-2 py-0.5 rounded-full mb-1">
                                      {completedGroups}/{totalGroups} 그룹
                                    </span>
                                    {latestPct !== null && <p className="text-xs text-gray-500">최근 {latestPct}%</p>}
                                  </div>
                                )}
                                {wsScores.length > 0 && (
                                  <p className="text-xs text-gray-300">{wsScores.length}회 도전</p>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
