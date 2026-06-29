"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";

interface Student  { id: number; name: string; username: string; avatar: string; approved: boolean; isEnrolled: boolean; parentName?: string; parentPhone?: string; createdAt: string; expiresAt?: string; }
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

  async function extendStudent(id: number, days: number) {
    await fetch(`/api/students/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extendDays: days }),
    });
    loadStudents();
  }

  function expiryLabel(s: Student) {
    if (!s.expiresAt) return null;
    const exp = new Date(s.expiresAt);
    const now = new Date();
    const diff = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { text: "만료됨", color: "#E8463A", bg: "#FFF0EE" };
    if (diff <= 7) return { text: `D-${diff}`, color: "#F6A800", bg: "#FFFBEE" };
    return { text: `D-${diff}`, color: "#76C043", bg: "#F0FBE8" };
  }

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

  const cardStyle = { background: "#fff", border: "1.5px solid #F0E8C8", borderRadius: "16px" };
  const inputStyle = { border: "1.5px solid #E8E0C8", borderRadius: "10px", padding: "8px 12px", fontSize: "13px", outline: "none", background: "#fff" };
  const btnPrimary = { background: "#1F2A44", color: "#F6E27F", borderRadius: "10px", padding: "9px 16px", fontWeight: 900, fontSize: "13px", cursor: "pointer", border: "none" };
  const btnGreen   = { background: "#76C043", color: "#fff", borderRadius: "10px", padding: "9px 16px", fontWeight: 900, fontSize: "12px", cursor: "pointer", border: "none" };
  const btnRed     = { background: "#FFF0EE", color: "#E8463A", borderRadius: "10px", padding: "9px 16px", fontWeight: 900, fontSize: "12px", cursor: "pointer", border: "1.5px solid #F0C0BC" };

  const TAB_LABELS: Record<Tab, string> = { pending: "⏳ 승인 대기", students: "👥 학생 관리", words: "📚 단어장 관리", results: "📊 학습 결과" };

  return (
    <div className="min-h-screen" style={{ background: "#FFF9E6" }}>
      {/* 남색 헤더 */}
      <div style={{ background: "#1F2A44", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img src="/TheFluent/logo.clear.png" alt="The Fluent" style={{ height: "32px", objectFit: "contain", filter: "brightness(0) invert(1)" }} />
          <div style={{ width: "1px", height: "22px", background: "rgba(255,255,255,0.15)" }} />
          <span style={{ fontSize: "14px", fontWeight: 900, color: "#F6E27F" }}>선생님 관리페이지</span>
        </div>
        <div style={{ display: "flex", gap: "14px" }}>
          <button onClick={() => router.push("/")} style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", background: "none", border: "none", cursor: "pointer" }}>학생 홈 보기</button>
          <button onClick={handleLogout} style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", background: "none", border: "none", cursor: "pointer" }}>로그아웃</button>
        </div>
      </div>

      {/* 탭 */}
      <div style={{ background: "#1F2A44", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", padding: "0 24px", gap: "2px" }}>
        {(["pending", "students", "words", "results"] as Tab[]).map(t => {
          const pendingCount = students.filter(s => !s.approved).length;
          const active = tab === t;
          return (
            <button key={t} onClick={() => { setTab(t); if (t === "results") loadResults(); }}
              style={{ padding: "12px 16px", fontSize: "12px", fontWeight: active ? 900 : 700, color: active ? "#F6E27F" : "rgba(255,255,255,0.4)", background: "none", border: "none", borderBottom: active ? "2px solid #F6E27F" : "2px solid transparent", cursor: "pointer", position: "relative" }}>
              {TAB_LABELS[t]}
              {t === "pending" && pendingCount > 0 && (
                <span style={{ marginLeft: "5px", background: "#E8463A", color: "#fff", fontSize: "10px", fontWeight: 900, padding: "1px 5px", borderRadius: "999px" }}>{pendingCount}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* ── 승인 대기 ── */}
        {tab === "pending" && (
          <div style={cardStyle} className="overflow-hidden">
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #F0E8C8", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 900, color: "#1F2A44", fontSize: "14px" }}>⏳ 가입 승인 대기</span>
              <span style={{ fontSize: "11px", color: "#AAAAAA" }}>승인해야 학생이 앱을 이용할 수 있어요</span>
            </div>
            {students.filter(s => !s.approved).length === 0 ? (
              <div className="text-center py-12" style={{ color: "#AAAAAA" }}>
                <div className="text-4xl mb-2">✅</div>
                <p>대기 중인 학생이 없어요!</p>
              </div>
            ) : (
              <div>
                {students.filter(s => !s.approved).map(s => (
                  <div key={s.id} style={{ padding: "14px 20px", borderBottom: "1px solid #F8F4EC", display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "24px" }}>{s.avatar}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "3px" }}>
                        <span style={{ fontWeight: 900, color: "#1F2A44", fontSize: "14px" }}>{s.name}</span>
                        <span style={{ fontSize: "9px", background: s.isEnrolled ? "#FFFBEE" : "#F0F4FF", color: s.isEnrolled ? "#C8A800" : "#4466CC", borderRadius: "999px", padding: "1px 7px", fontWeight: 800 }}>
                          {s.isEnrolled ? "재원" : "비재원"}
                        </span>
                      </div>
                      <p style={{ fontSize: "11px", color: "#AAAAAA" }}>@{s.username} · {new Date(s.createdAt).toLocaleDateString("ko-KR")}</p>
                      {!s.isEnrolled && s.parentName && (
                        <p style={{ fontSize: "11px", color: "#76C043", fontWeight: 700, marginTop: "2px" }}>👪 {s.parentName} · {s.parentPhone}</p>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={() => approveStudent(s.id, true)} style={btnGreen}>✅ 승인</button>
                      <button onClick={() => deleteStudent(s.id)} style={btnRed}>❌ 거절</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 학생 관리 ── */}
        {tab === "students" && (
          <div className="space-y-4">
            <div style={{ ...cardStyle, padding: "18px 20px" }}>
              <div style={{ fontWeight: 900, color: "#1F2A44", fontSize: "13px", marginBottom: "12px" }}>➕ 학생 직접 추가</div>
              <form onSubmit={addStudent} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "8px" }}>
                <input value={sName} onChange={e => setSName(e.target.value)} placeholder="이름" required style={inputStyle} />
                <input value={sUsername} onChange={e => setSUsername(e.target.value)} placeholder="아이디" required style={inputStyle} />
                <input value={sPassword} onChange={e => setSPassword(e.target.value)} placeholder="비밀번호" required style={inputStyle} />
                <div style={{ display: "flex", gap: "6px" }}>
                  <select value={sAvatar} onChange={e => setSAvatar(e.target.value)} style={{ ...inputStyle, width: "48px", textAlign: "center", padding: "8px 6px" }}>
                    {AVATARS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <button type="submit" style={btnPrimary}>추가</button>
                </div>
              </form>
              {sError && <p style={{ color: "#E8463A", fontSize: "12px", marginTop: "8px" }}>{sError}</p>}
            </div>

            <div style={{ ...cardStyle, padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <span style={{ fontWeight: 900, color: "#1F2A44", fontSize: "13px" }}>📊 엑셀로 일괄 등록</span>
                <button onClick={downloadTemplate} style={{ fontSize: "11px", color: "#76C043", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>템플릿 다운로드</button>
              </div>
              <p style={{ fontSize: "11px", color: "#AAAAAA", marginBottom: "10px" }}>열 이름: 이름, 아이디, 비밀번호, 아바타(선택)</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleExcelUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-slate-100 file:text-slate-700 file:font-bold hover:file:bg-slate-200 cursor-pointer" />
            </div>

            <div style={{ ...cardStyle, overflow: "hidden" }}>
              <div style={{ padding: "12px 20px", borderBottom: "1px solid #F0E8C8", fontWeight: 900, color: "#1F2A44", fontSize: "13px" }}>
                👥 학생 목록 ({students.length}명)
              </div>
              {students.length === 0 ? (
                <div className="text-center py-10" style={{ color: "#AAAAAA" }}>아직 학생이 없어요</div>
              ) : (
                <div>
                  {students.map(s => (
                    <div key={s.id} style={{ padding: "12px 20px", borderBottom: "1px solid #F8F4EC", display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "22px" }}>{s.avatar}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontWeight: 800, color: "#1F2A44", fontSize: "13px" }}>{s.name}</span>
                          <span style={{ fontSize: "9px", background: s.isEnrolled ? "#FFFBEE" : "#F0F4FF", color: s.isEnrolled ? "#C8A800" : "#4466CC", borderRadius: "999px", padding: "1px 6px", fontWeight: 800 }}>
                            {s.isEnrolled ? "재원" : "비재원"}
                          </span>
                          {!s.approved && <span style={{ fontSize: "9px", background: "#FFF0EE", color: "#E8463A", borderRadius: "999px", padding: "1px 6px", fontWeight: 800 }}>미승인</span>}
                        </div>
                        <p style={{ fontSize: "11px", color: "#AAAAAA" }}>@{s.username}</p>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "5px" }}>
                        {/* 만료일 뱃지 (비재원생만) */}
                        {!s.isEnrolled && (() => {
                          const lbl = expiryLabel(s);
                          return lbl ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                              <span style={{ fontSize: "10px", background: lbl.bg, color: lbl.color, borderRadius: "999px", padding: "2px 8px", fontWeight: 800 }}>{lbl.text}</span>
                              <button onClick={() => extendStudent(s.id, 30)} style={{ fontSize: "10px", color: "#4466CC", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>+30일</button>
                            </div>
                          ) : null;
                        })()}
                        {pwStudentId === s.id ? (
                          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                            <input value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="새 비밀번호" style={{ ...inputStyle, width: "120px", fontSize: "12px" }} />
                            <button onClick={() => changePassword(s.id)} style={{ ...btnPrimary, padding: "7px 12px", fontSize: "12px" }}>변경</button>
                            <button onClick={() => setPwStudentId(null)} style={{ fontSize: "12px", color: "#AAAAAA", background: "none", border: "none", cursor: "pointer" }}>취소</button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: "10px" }}>
                            <button onClick={() => { setPwStudentId(s.id); setNewPw(""); }} style={{ fontSize: "11px", color: "#4466CC", background: "none", border: "none", cursor: "pointer" }}>비밀번호 변경</button>
                            <button onClick={() => deleteStudent(s.id)} style={{ fontSize: "11px", color: "#E8463A", background: "none", border: "none", cursor: "pointer" }}>삭제</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 단어장 관리 ── */}
        {tab === "words" && (
          <div className="grid md:grid-cols-2 gap-5">
            <div className="space-y-4">
              <div style={{ ...cardStyle, padding: "18px 20px" }}>
                <div style={{ fontWeight: 900, color: "#1F2A44", fontSize: "13px", marginBottom: "12px" }}>➕ 단어장 추가</div>
                <form onSubmit={addWordSet} style={{ display: "flex", gap: "8px" }}>
                  <input value={wsEmoji} onChange={e => setWsEmoji(e.target.value)} placeholder="📚" style={{ ...inputStyle, width: "50px", textAlign: "center", fontSize: "18px" }} />
                  <input value={wsName} onChange={e => setWsName(e.target.value)} placeholder="단어장 이름" required style={{ ...inputStyle, flex: 1 }} />
                  <button type="submit" style={btnPrimary}>추가</button>
                </form>
                {wsError && <p style={{ color: "#E8463A", fontSize: "12px", marginTop: "8px" }}>{wsError}</p>}
              </div>

              <div style={{ ...cardStyle, overflow: "hidden" }}>
                <div style={{ padding: "12px 20px", borderBottom: "1px solid #F0E8C8", fontWeight: 900, color: "#1F2A44", fontSize: "13px" }}>📚 단어장 목록</div>
                {wordSets.length === 0 ? (
                  <div className="text-center py-8" style={{ color: "#AAAAAA", fontSize: "13px" }}>단어장이 없어요</div>
                ) : (
                  <div>
                    {wordSets.map(ws => (
                      <div key={ws.id}
                        style={{ padding: "12px 20px", borderBottom: "1px solid #F8F4EC", display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", background: selectedWs?.id === ws.id ? "#FFFBEE" : "transparent" }}
                        onClick={() => { setSelectedWs(ws); loadWords(ws); }}>
                        <span style={{ fontSize: "18px" }}>{ws.emoji}</span>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontWeight: 800, color: "#1F2A44", fontSize: "13px" }}>{ws.name}</p>
                          <p style={{ fontSize: "11px", color: "#AAAAAA" }}>{ws._count.words}개 단어</p>
                        </div>
                        <button onClick={e => { e.stopPropagation(); deleteWordSet(ws.id); }} style={{ fontSize: "11px", color: "#E8463A", background: "none", border: "none", cursor: "pointer" }}>삭제</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {selectedWs ? (
                <>
                  <div style={{ ...cardStyle, padding: "18px 20px" }}>
                    <div style={{ fontWeight: 900, color: "#1F2A44", fontSize: "13px", marginBottom: "12px" }}>{selectedWs.emoji} {selectedWs.name} — 단어 추가</div>
                    <form onSubmit={addWord} style={{ display: "flex", gap: "8px" }}>
                      <input value={wEng} onChange={e => setWEng(e.target.value)} placeholder="English" required style={{ ...inputStyle, flex: 1 }} />
                      <input value={wKor} onChange={e => setWKor(e.target.value)} placeholder="한국어 뜻" required style={{ ...inputStyle, flex: 1 }} />
                      <button type="submit" style={btnPrimary}>추가</button>
                    </form>
                    {wError && <p style={{ color: "#E8463A", fontSize: "12px", marginTop: "8px" }}>{wError}</p>}
                  </div>
                  <div style={{ ...cardStyle, overflow: "hidden" }}>
                    <div style={{ padding: "12px 20px", borderBottom: "1px solid #F0E8C8", fontWeight: 900, color: "#1F2A44", fontSize: "13px" }}>{wsWords.length}개 단어</div>
                    {wsWords.length === 0 ? (
                      <div className="text-center py-8" style={{ color: "#AAAAAA", fontSize: "13px" }}>단어를 추가해주세요</div>
                    ) : (
                      <div style={{ maxHeight: "360px", overflowY: "auto" }}>
                        {wsWords.map(w => (
                          <div key={w.id} style={{ padding: "10px 20px", borderBottom: "1px solid #F8F4EC", display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{ fontWeight: 800, color: "#1F2A44", fontSize: "13px", width: "110px" }}>{w.english}</span>
                            <span style={{ color: "#8A96A8", fontSize: "13px", flex: 1 }}>{w.korean}</span>
                            <button onClick={() => deleteWord(w.id)} style={{ fontSize: "11px", color: "#E8463A", background: "none", border: "none", cursor: "pointer" }}>삭제</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ ...cardStyle, padding: "40px", textAlign: "center", color: "#AAAAAA" }}>
                  <p style={{ fontSize: "36px", marginBottom: "10px" }}>👈</p>
                  <p style={{ fontWeight: 700 }}>단어장을 선택하면<br />단어를 추가할 수 있어요</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 학습 결과 ── */}
        {tab === "results" && (
          <div style={{ ...cardStyle, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #F0E8C8", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 900, color: "#1F2A44", fontSize: "14px" }}>📊 학생별 학습 결과</span>
              <button onClick={loadResults} style={{ fontSize: "11px", color: "#76C043", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>🔄 새로고침</button>
            </div>
            {students.length === 0 ? (
              <div className="text-center py-12" style={{ color: "#AAAAAA" }}>학생이 없어요</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "#FFFBEE", borderBottom: "1px solid #F0E8C8" }}>
                      <th className="px-4 py-3 text-left" style={{ fontWeight: 900, color: "#1F2A44" }}>학생</th>
                      {resultsWordSets.map(ws => (
                        <th key={ws.id} className="px-4 py-3 text-center whitespace-nowrap" style={{ fontWeight: 900, color: "#1F2A44" }}>
                          {ws.emoji} {ws.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(s => (
                      <tr key={s.id} style={{ borderBottom: "1px solid #F8F4EC" }}>
                        <td className="px-4 py-3">
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "20px" }}>{s.avatar}</span>
                            <div>
                              <p style={{ fontWeight: 800, color: "#1F2A44", fontSize: "13px" }}>{s.name}</p>
                              <p style={{ fontSize: "11px", color: "#AAAAAA" }}>@{s.username}</p>
                            </div>
                          </div>
                        </td>
                        {resultsWordSets.map(ws => {
                          const wsScores = scores.filter(sc => sc.studentId === s.id && sc.wordSetId === ws.id);
                          const progress = progresses.find(p => p.studentId === s.id && p.wordSetId === ws.id);
                          const totalGroups = Math.ceil(ws._count.words / 5);
                          if (wsScores.length === 0 && !progress) {
                            return <td key={ws.id} className="px-4 py-3 text-center" style={{ color: "#CCCCCC", fontSize: "11px" }}>미시작</td>;
                          }
                          const latest = wsScores[0];
                          const latestPct = latest && latest.totalQuestions > 0 ? Math.round(latest.score / latest.totalQuestions * 100) : null;
                          const completedGroups = progress?.batchIdx ?? (wsScores.length > 0 ? totalGroups : 0);
                          const isComplete = !progress && wsScores.length > 0;
                          return (
                            <td key={ws.id} className="px-4 py-3 text-center">
                              {isComplete ? (
                                <div>
                                  <span style={{ display: "inline-block", background: "#F0FBE8", color: "#76C043", fontSize: "10px", fontWeight: 800, padding: "2px 8px", borderRadius: "999px", marginBottom: "3px" }}>완료 ✅</span>
                                  {latestPct !== null && <p style={{ fontSize: "10px", color: "#AAAAAA" }}>최근 {latestPct}%</p>}
                                </div>
                              ) : (
                                <div>
                                  <span style={{ display: "inline-block", background: "#F0F4FF", color: "#4466CC", fontSize: "10px", fontWeight: 800, padding: "2px 8px", borderRadius: "999px", marginBottom: "3px" }}>
                                    {completedGroups}/{totalGroups} 그룹
                                  </span>
                                  {latestPct !== null && <p style={{ fontSize: "10px", color: "#AAAAAA" }}>최근 {latestPct}%</p>}
                                </div>
                              )}
                              {wsScores.length > 0 && <p style={{ fontSize: "10px", color: "#CCCCCC" }}>{wsScores.length}회 도전</p>}
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
        )}
      </div>
    </div>
  );
}
