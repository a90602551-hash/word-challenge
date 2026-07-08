"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const AVATARS = ["🐥", "🐶", "🐱", "🐰", "🐻", "🦊", "🐸", "🐧", "🦄", "🐯", "🐼", "🐨"];
const RANK_MEDALS = ["🥇", "🥈", "🥉"];

interface RankStudent { id: number; name: string; avatar: string; }
interface GradeRanking {
  wordSetId: number; name: string; emoji: string;
  volumeTop3: { rank: number; student: RankStudent; sessions: number; }[];
  scoreTop3:  { rank: number; student: RankStudent; avgAccuracy: number; }[];
  myVolume: { rank: number; sessions: number; gapToAbove: number } | null;
  myScore:  { rank: number; avgAccuracy: number; gapToAbove: number } | null;
}

export default function MainPage() {
  const router = useRouter();
  const [mode, setMode]         = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]         = useState("");
  const [avatar, setAvatar]     = useState("🐥");
  const [isEnrolled, setIsEnrolled] = useState(true);
  const [parentName, setParentName]   = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [rankings, setRankings] = useState<GradeRanking[]>([]);
  const [overall, setOverall]   = useState<{ volumeTop3: any[]; scoreTop3: any[]; myVolume: any; myScore: any } | null>(null);
  const [gradeTab, setGradeTab] = useState(0);
  const [myName, setMyName]     = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/rankings").then(r => r.json()).then(d => { setRankings(d.rankings || []); setOverall(d.overall || null); }).catch(() => {});
    fetch("/api/auth/me").then(r => r.ok ? r.json() : null).then(d => { if (d?.name) setMyName(d.name); }).catch(() => {});
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      if (data.error === "pending") {
        setError("⏳ 선생님 승인 대기 중이에요! 곧 이용할 수 있어요 😊");
      } else if (data.error === "expired") {
        setError("⛔ 30일 무료 체험이 종료되었어요. 선생님께 문의해주세요!");
      } else {
        setError(data.error);
      }
      return;
    }
    router.push("/challenge");
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, username, password, avatar, isEnrolled, parentName, parentPhone }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error); return; }
    router.push("/placement");
  }

  const currentRanking = rankings[gradeTab];
  const [overallTab, setOverallTab] = useState<"volume" | "score">("volume");
  const inputCls = "w-full border-2 border-gray-200 focus:border-[#F6E27F] rounded-2xl px-4 py-3 text-base outline-none transition-all bg-gray-50 focus:bg-white";
  const labelCls = "text-xs font-extrabold text-[#1F2A44]/60 mb-1 block uppercase tracking-wide";
  const BAR_COLORS = ["#F6E27F", "#B8D4F0", "#76C043"];

  return (
    <div className="min-h-screen" style={{ background: "#FFF9E6" }}>
      <div className="max-w-6xl mx-auto px-8 py-8">

        {/* 헤더 */}
        <div className="main-header flex items-center justify-between mb-8" style={{ gap: "20px" }}>
          <div className="flex items-center" style={{ gap: "16px" }}>
            <img src="/TheFluent/logo.clear.png" alt="The Fluent" style={{ height: "120px", objectFit: "contain", flexShrink: 0 }} />
            <div className="main-divider" style={{ width: "1px", height: "40px", background: "#E0D8C0" }} />
            <div>
              <h1 className="main-header-title font-black" style={{ color: "#1F2A44", lineHeight: 1.1, fontSize: "24px" }}>단어 챌린지</h1>
              <p className="main-header-sub font-bold mt-0.5" style={{ color: "#76C043", letterSpacing: "1px", fontSize: "12px" }}>영어 단어 왕은 누구?! 🏆</p>
            </div>
          </div>
          <button onClick={() => router.push("/admin/login")} className="main-teacher-btn text-xs transition-all" style={{ color: "#C0C8D8", whiteSpace: "nowrap" }}>
            선생님 로그인
          </button>
        </div>

        {/* 2단 레이아웃 */}
        <div className="main-grid">

          {/* 왼쪽: 순위판 */}
          <div className="main-rank-col rounded-3xl p-6 bg-white" style={{ border: "1.5px solid #F0E8C8", boxShadow: "0 2px 12px rgba(246,226,127,0.2)" }}>

            {/* 종합 순위 — 포디움 */}
            {overall && (() => {
              const list = overallTab === "volume" ? overall.volumeTop3 : overall.scoreTop3;
              const getValue = (e: any) => overallTab === "volume" ? `${e.sessions}회` : `${e.avgAccuracy}점`;
              // 포디움 순서: 2등(왼쪽) 1등(가운데) 3등(오른쪽)
              const podium = [list[1], list[0], list[2]];
              const podiumHeights = ["36px", "52px", "24px"];
              const podiumColors = ["rgba(255,255,255,0.15)", "#F6E27F", "rgba(255,255,255,0.08)"];
              const podiumTextColors = ["white", "#1F2A44", "rgba(255,255,255,0.6)"];
              return (
                <div className="mb-6 rounded-2xl" style={{ background: "#1F2A44", border: "2px solid #F6E27F", overflow: "hidden" }}>
                  <div style={{ padding: "14px 16px 10px" }}>
                    <p className="font-black text-sm" style={{ color: "#F6E27F" }}>🏆 종합 순위</p>
                    <p style={{ fontSize: "10px", color: "rgba(246,226,127,0.6)", marginTop: "2px" }}>챌린지 시상은 종합순위로 해요!</p>
                  </div>

                  {/* 탭 */}
                  <div style={{ display: "flex", gap: "6px", padding: "0 16px 12px" }}>
                    {(["volume", "score"] as const).map(t => (
                      <button key={t} onClick={() => setOverallTab(t)}
                        style={{ flex: 1, padding: "5px 0", borderRadius: "8px", fontSize: "11px", fontWeight: 800, cursor: "pointer", border: "none",
                          background: overallTab === t ? "rgba(246,226,127,0.2)" : "rgba(255,255,255,0.05)",
                          color: overallTab === t ? "#F6E27F" : "rgba(255,255,255,0.35)" }}>
                        {t === "volume" ? "⚡ 학습량" : "⭐ 성적"}
                      </button>
                    ))}
                  </div>

                  {/* 포디움 */}
                  {list.length === 0 ? (
                    <p style={{ textAlign: "center", padding: "20px", fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>아직 기록이 없어요!</p>
                  ) : (
                    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "8px", padding: "0 16px" }}>
                      {podium.map((entry, pi) => entry ? (
                        <div key={entry.student?.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", flex: 1 }}>
                          <span style={{ fontSize: "22px" }}>{entry.student?.avatar}</span>
                          <span style={{ fontSize: "11px", fontWeight: 800, color: "white", textAlign: "center" }}>{entry.student?.name}</span>
                          <span style={{ fontSize: "10px", fontWeight: 800, color: "#F6E27F" }}>{getValue(entry)}</span>
                          <div style={{ width: "100%", height: podiumHeights[pi], background: podiumColors[pi], borderRadius: "8px 8px 0 0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: pi === 1 ? "18px" : "14px", color: podiumTextColors[pi], fontWeight: 900 }}>
                            {RANK_MEDALS[pi === 0 ? 1 : pi === 1 ? 0 : 2]}
                          </div>
                        </div>
                      ) : <div key={pi} style={{ flex: 1 }} />)}
                    </div>
                  )}

                  {/* 내 종합 순위 */}
                  {myName && (overall.myVolume || overall.myScore) && (
                    <div style={{ margin: "10px 16px 14px", borderRadius: "10px", padding: "10px 12px", background: "rgba(246,226,127,0.1)", border: "1px solid rgba(246,226,127,0.25)" }}>
                      <p style={{ fontSize: "10px", fontWeight: 900, color: "#F6E27F", marginBottom: "6px" }}>🙋 {myName}의 종합 순위</p>
                      <div style={{ display: "flex", gap: "12px" }}>
                        {overall.myVolume && <div><p style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)" }}>⚡ 학습량</p><p style={{ fontSize: "13px", fontWeight: 900, color: "white" }}>{overall.myVolume.rank}위 <span style={{ color: "#F6E27F" }}>{overall.myVolume.sessions}회</span></p></div>}
                        {overall.myScore && <div><p style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)" }}>⭐ 성적</p><p style={{ fontSize: "13px", fontWeight: 900, color: "white" }}>{overall.myScore.rank}위 <span style={{ color: "#76C043" }}>{overall.myScore.avgAccuracy}점</span></p></div>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            <p className="font-black text-sm mb-3" style={{ color: "#1F2A44" }}>📚 학년별 순위</p>

            {/* 학년 탭 — 가로 스크롤 칩 */}
            <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "10px", scrollbarWidth: "none", marginBottom: "4px" }}>
              {rankings.map((r, i) => (
                <button key={r.wordSetId} onClick={() => setGradeTab(i)}
                  style={{ flexShrink: 0, padding: "5px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 800, cursor: "pointer", border: "none", transition: "all 0.15s",
                    background: gradeTab === i ? "#1F2A44" : "#F0EAD8",
                    color: gradeTab === i ? "#F6E27F" : "#8A8A8A" }}>
                  {r.name.replace("학년", "")}
                </button>
              ))}
            </div>

            {currentRanking && (
              <div>
                {/* 학습량 */}
                <p style={{ fontSize: "10px", fontWeight: 900, color: "#76C043", marginBottom: "8px", marginTop: "4px" }}>⚡ 학습량 TOP 3</p>
                {currentRanking.volumeTop3.length === 0 ? (
                  <p style={{ fontSize: "12px", color: "#CCCCCC", marginBottom: "12px" }}>아직 기록이 없어요!</p>
                ) : (
                  <div style={{ marginBottom: "14px" }}>
                    {currentRanking.volumeTop3.map((entry, i) => {
                      const max = currentRanking.volumeTop3[0]?.sessions ?? 1;
                      const pct = Math.round((entry.sessions / max) * 100);
                      return (
                        <div key={entry.student?.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 0", borderBottom: "1px solid #F0E8C8" }}>
                          <span style={{ fontSize: "16px", width: "20px", textAlign: "center" }}>{RANK_MEDALS[i]}</span>
                          <span style={{ fontSize: "18px" }}>{entry.student?.avatar}</span>
                          <span style={{ flex: 1, fontWeight: 800, fontSize: "13px", color: "#1F2A44" }}>{entry.student?.name}</span>
                          <div style={{ width: "70px", background: "#F0ECE0", borderRadius: "4px", height: "5px", overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: BAR_COLORS[i], borderRadius: "4px" }} />
                          </div>
                          <span style={{ fontSize: "11px", fontWeight: 900, color: "#1F2A44", width: "28px", textAlign: "right" }}>{entry.sessions}회</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 성적 */}
                <p style={{ fontSize: "10px", fontWeight: 900, color: "#76C043", marginBottom: "8px" }}>⭐ 성적 TOP 3</p>
                {currentRanking.scoreTop3.length === 0 ? (
                  <p style={{ fontSize: "12px", color: "#CCCCCC" }}>아직 기록이 없어요!</p>
                ) : (
                  <div>
                    {currentRanking.scoreTop3.map((entry, i) => {
                      const max = currentRanking.scoreTop3[0]?.avgAccuracy ?? 1;
                      const pct = Math.round((entry.avgAccuracy / max) * 100);
                      return (
                        <div key={entry.student?.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 0", borderBottom: "1px solid #F0E8C8" }}>
                          <span style={{ fontSize: "16px", width: "20px", textAlign: "center" }}>{RANK_MEDALS[i]}</span>
                          <span style={{ fontSize: "18px" }}>{entry.student?.avatar}</span>
                          <span style={{ flex: 1, fontWeight: 800, fontSize: "13px", color: "#1F2A44" }}>{entry.student?.name}</span>
                          <div style={{ width: "70px", background: "#F0ECE0", borderRadius: "4px", height: "5px", overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: BAR_COLORS[i], borderRadius: "4px" }} />
                          </div>
                          <span style={{ fontSize: "11px", fontWeight: 900, color: "#1F2A44", width: "28px", textAlign: "right" }}>{entry.avgAccuracy}점</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 내 학년 순위 */}
                {myName && (currentRanking.myVolume || currentRanking.myScore) && (
                  <div style={{ marginTop: "14px", borderRadius: "12px", padding: "12px", background: "#FFFBEE", border: "1px solid #F0E8C8" }}>
                    <p style={{ fontSize: "11px", fontWeight: 900, color: "#1F2A44", marginBottom: "8px" }}>🙋 {myName}의 순위</p>
                    <div style={{ display: "flex", gap: "12px" }}>
                      {currentRanking.myVolume && (
                        <div style={{ flex: 1, background: "white", borderRadius: "10px", padding: "8px 10px", border: "1px solid #F0E8C8" }}>
                          <p style={{ fontSize: "10px", color: "#AAAAAA", marginBottom: "2px" }}>⚡ 학습량</p>
                          <p style={{ fontSize: "13px", fontWeight: 900, color: "#1F2A44" }}>{currentRanking.myVolume.rank}위 <span style={{ color: "#C8A800" }}>{currentRanking.myVolume.sessions}회</span></p>
                          {currentRanking.myVolume.rank > 1
                            ? <p style={{ fontSize: "10px", color: "#AAAAAA", marginTop: "2px" }}>{currentRanking.myVolume.gapToAbove}회 차이</p>
                            : <p style={{ fontSize: "10px", color: "#C8A800", fontWeight: 800, marginTop: "2px" }}>🏆 1위!</p>}
                        </div>
                      )}
                      {currentRanking.myScore && (
                        <div style={{ flex: 1, background: "white", borderRadius: "10px", padding: "8px 10px", border: "1px solid #D6EEC4" }}>
                          <p style={{ fontSize: "10px", color: "#AAAAAA", marginBottom: "2px" }}>⭐ 성적</p>
                          <p style={{ fontSize: "13px", fontWeight: 900, color: "#1F2A44" }}>{currentRanking.myScore.rank}위 <span style={{ color: "#4A9A1A" }}>{currentRanking.myScore.avgAccuracy}점</span></p>
                          {currentRanking.myScore.rank > 1
                            ? <p style={{ fontSize: "10px", color: "#AAAAAA", marginTop: "2px" }}>{currentRanking.myScore.gapToAbove}점 차이</p>
                            : <p style={{ fontSize: "10px", color: "#4A9A1A", fontWeight: 800, marginTop: "2px" }}>🏆 1위!</p>}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {rankings.length === 0 && (
              <p className="text-center py-8 text-sm" style={{ color: "#CCCCCC" }}>아직 순위 기록이 없어요!</p>
            )}
          </div>

          {/* 오른쪽: 로그인/회원가입 */}
          <div className="main-login-col rounded-3xl p-7 bg-white" style={{ border: "1.5px solid #F0E8C8", boxShadow: "0 2px 12px rgba(246,226,127,0.2)" }}>
            <div className="grid grid-cols-2 gap-2 mb-6">
              <button onClick={() => { setMode("login"); setError(""); }}
                className="py-3 rounded-2xl font-extrabold text-sm transition-all"
                style={mode === "login" ? { background: "#1F2A44", color: "#F6E27F" } : { background: "#F5F5F5", color: "#AAAAAA" }}>
                로그인
              </button>
              <button onClick={() => { setMode("signup"); setError(""); }}
                className="py-3 rounded-2xl font-extrabold text-sm transition-all"
                style={mode === "signup" ? { background: "#1F2A44", color: "#F6E27F" } : { background: "#F5F5F5", color: "#AAAAAA" }}>
                회원가입
              </button>
            </div>

            {mode === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className={labelCls}>아이디</label>
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)} required
                    placeholder="아이디를 입력하세요" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>비밀번호</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                    placeholder="비밀번호를 입력하세요" className={inputCls} />
                </div>
                {error && <div className="rounded-2xl px-4 py-3 text-sm text-center font-bold" style={{ background: "#fff3cd", color: "#92400e" }}>{error}</div>}
                <button type="submit" disabled={loading}
                  className="w-full font-extrabold text-lg py-4 rounded-2xl transition-all active:scale-95 disabled:opacity-50"
                  style={{ background: "#F6E27F", color: "#1F2A44" }}>
                  {loading ? "로그인 중... ✨" : "시작하기! 🎮"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <label className={labelCls}>이름</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} required
                    placeholder="이름을 입력하세요" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>아이디</label>
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)} required
                    placeholder="영문/숫자" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>비밀번호</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                    placeholder="4자 이상" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>재원 여부</label>
                  <div className="flex gap-2">
                    {[{ val: true, label: "🏫 재원생" }, { val: false, label: "🏠 비재원생" }].map(({ val, label }) => (
                      <button key={String(val)} type="button" onClick={() => setIsEnrolled(val)}
                        className="flex-1 py-3 rounded-2xl font-extrabold text-sm transition-all border-2"
                        style={isEnrolled === val
                          ? { background: "#1F2A44", color: "#F6E27F", borderColor: "#1F2A44" }
                          : { background: "#f9fafb", color: "#9ca3af", borderColor: "#e5e7eb" }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {!isEnrolled && (
                  <>
                    <div>
                      <label className={labelCls}>학부모 성함</label>
                      <input type="text" value={parentName} onChange={e => setParentName(e.target.value)} required
                        placeholder="학부모 성함" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>학부모 휴대폰 번호</label>
                      <input type="tel" value={parentPhone} onChange={e => setParentPhone(e.target.value)} required
                        placeholder="010-0000-0000" className={inputCls} />
                    </div>
                  </>
                )}
                <div>
                  <label className={labelCls}>아바타 고르기</label>
                  <div className="flex flex-wrap gap-2">
                    {AVATARS.map(a => (
                      <button key={a} type="button" onClick={() => setAvatar(a)}
                        className="text-2xl w-11 h-11 rounded-xl transition-all"
                        style={avatar === a
                          ? { background: "#F6E27F", transform: "scale(1.1)" }
                          : { background: "#f3f4f6" }}>
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
                {error && <div className="rounded-2xl px-4 py-3 text-sm text-center font-bold" style={{ background: "#fff3cd", color: "#92400e" }}>{error}</div>}
                <button type="submit" disabled={loading}
                  className="w-full font-extrabold text-lg py-4 rounded-2xl transition-all active:scale-95 disabled:opacity-50"
                  style={{ background: "#76C043", color: "white" }}>
                  {loading ? "등록 중... ✨" : "가입하고 시작하기! 🚀"}
                </button>
              </form>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
