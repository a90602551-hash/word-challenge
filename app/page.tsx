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
  const [gradeTab, setGradeTab] = useState(0);
  const [myName, setMyName]     = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/rankings").then(r => r.json()).then(d => setRankings(d.rankings || [])).catch(() => {});
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

  const inputCls = "w-full border-2 border-gray-200 focus:border-[#F6E27F] rounded-2xl px-4 py-3 text-base outline-none transition-all bg-gray-50 focus:bg-white";
  const labelCls = "text-xs font-extrabold text-[#1F2A44]/60 mb-1 block uppercase tracking-wide";

  return (
    <div className="min-h-screen" style={{ background: "#1F2A44" }}>

      {/* 헤더 */}
      <div className="text-center pt-10 pb-6 px-4">
        <div className="inline-flex items-center gap-2 mb-3">
          <span className="text-4xl">✏️</span>
          <div>
            <h1 className="text-3xl font-extrabold leading-none" style={{ color: "#F6E27F" }}>단어 챌린지</h1>
            <p className="text-xs font-bold mt-0.5" style={{ color: "#76C043" }}>by The Fluent</p>
          </div>
        </div>
        <p className="text-white/50 text-sm">영어 단어 왕은 누구?! 🏆</p>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-10 space-y-4">

        {/* 순위판 */}
        {rankings.length > 0 && (
          <div className="rounded-3xl p-5" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <h2 className="font-extrabold text-sm mb-3" style={{ color: "#F6E27F" }}>🏆 학년별 순위</h2>

            {/* 학년 탭 */}
            <div className="flex gap-2 mb-4">
              {rankings.map((r, i) => (
                <button key={r.wordSetId} onClick={() => setGradeTab(i)}
                  className="flex-1 py-2 rounded-xl text-xs font-extrabold transition-all"
                  style={gradeTab === i
                    ? { background: "#F6E27F", color: "#1F2A44" }
                    : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
                  {r.emoji} {r.name}
                </button>
              ))}
            </div>

            {currentRanking && (
              <div className="space-y-4">
                {/* 학습량 */}
                <div>
                  <p className="text-[11px] font-extrabold mb-2 uppercase tracking-wide" style={{ color: "#76C043" }}>⚡ 학습량 Top 3</p>
                  {currentRanking.volumeTop3.length === 0 ? (
                    <p className="text-center text-xs py-2 text-white/30">아직 기록이 없어요!</p>
                  ) : (() => {
                    const max = currentRanking.volumeTop3[0]?.sessions ?? 1;
                    const bars = ["#F6E27F", "rgba(255,255,255,0.5)", "#76C043"];
                    return (
                      <div className="space-y-3">
                        {currentRanking.volumeTop3.map((entry, i) => {
                          const pct = Math.round((entry.sessions / max) * 100);
                          const gap = i > 0 ? entry.sessions - currentRanking.volumeTop3[i-1].sessions : 0;
                          return (
                            <div key={entry.student?.id}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm w-5">{RANK_MEDALS[i]}</span>
                                <span className="text-base">{entry.student?.avatar}</span>
                                <span className="font-bold text-sm text-white flex-1 truncate">{entry.student?.name}</span>
                                <span className="text-xs font-extrabold" style={{ color: "#F6E27F" }}>{entry.sessions}회</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-5 shrink-0" />
                                <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: bars[i] }} />
                                </div>
                              </div>
                              {i > 0 && gap < 0 && (
                                <p className="text-[10px] mt-0.5 ml-7" style={{ color: "rgba(255,255,255,0.35)" }}>1위와 {Math.abs(gap)}회 차이</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }} />

                {/* 성적 */}
                <div>
                  <p className="text-[11px] font-extrabold mb-2 uppercase tracking-wide" style={{ color: "#76C043" }}>⭐ 성적 Top 3</p>
                  {currentRanking.scoreTop3.length === 0 ? (
                    <p className="text-center text-xs py-2 text-white/30">아직 기록이 없어요!</p>
                  ) : (() => {
                    const max = currentRanking.scoreTop3[0]?.avgAccuracy ?? 1;
                    const bars = ["#F6E27F", "rgba(255,255,255,0.5)", "#76C043"];
                    return (
                      <div className="space-y-3">
                        {currentRanking.scoreTop3.map((entry, i) => {
                          const pct = Math.round((entry.avgAccuracy / max) * 100);
                          const gap = i > 0 ? entry.avgAccuracy - currentRanking.scoreTop3[i-1].avgAccuracy : 0;
                          return (
                            <div key={entry.student?.id}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm w-5">{RANK_MEDALS[i]}</span>
                                <span className="text-base">{entry.student?.avatar}</span>
                                <span className="font-bold text-sm text-white flex-1 truncate">{entry.student?.name}</span>
                                <span className="text-xs font-extrabold" style={{ color: "#F6E27F" }}>{entry.avgAccuracy}%</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-5 shrink-0" />
                                <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: bars[i] }} />
                                </div>
                              </div>
                              {i > 0 && gap < 0 && (
                                <p className="text-[10px] mt-0.5 ml-7" style={{ color: "rgba(255,255,255,0.35)" }}>1위와 {Math.abs(gap)}% 차이</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* 내 순위 */}
                {myName && (currentRanking.myVolume || currentRanking.myScore) && (
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }} className="pt-3 space-y-2">
                    <p className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: "#F6E27F" }}>🙋 {myName}의 순위</p>
                    <div className="grid grid-cols-2 gap-2">
                      {currentRanking.myVolume && (
                        <div className="rounded-2xl px-3 py-2.5" style={{ background: "rgba(246,226,127,0.1)", border: "1px solid rgba(246,226,127,0.2)" }}>
                          <p className="text-[10px] font-bold mb-0.5 text-white/40">⚡ 학습량</p>
                          <p className="font-extrabold text-sm text-white">{currentRanking.myVolume.rank}위 <span style={{ color: "#F6E27F" }}>{currentRanking.myVolume.sessions}회</span></p>
                          {currentRanking.myVolume.rank > 1
                            ? <p className="text-[10px] mt-0.5 text-white/40">윗 순위까지 <span style={{ color: "#F6E27F" }} className="font-bold">{currentRanking.myVolume.gapToAbove}회</span> 차이</p>
                            : <p className="text-[10px] mt-0.5 font-bold" style={{ color: "#F6E27F" }}>🏆 1위!</p>}
                        </div>
                      )}
                      {currentRanking.myScore && (
                        <div className="rounded-2xl px-3 py-2.5" style={{ background: "rgba(118,192,67,0.1)", border: "1px solid rgba(118,192,67,0.2)" }}>
                          <p className="text-[10px] font-bold mb-0.5 text-white/40">⭐ 성적</p>
                          <p className="font-extrabold text-sm text-white">{currentRanking.myScore.rank}위 <span style={{ color: "#76C043" }}>{currentRanking.myScore.avgAccuracy}%</span></p>
                          {currentRanking.myScore.rank > 1
                            ? <p className="text-[10px] mt-0.5 text-white/40">윗 순위까지 <span style={{ color: "#76C043" }} className="font-bold">{currentRanking.myScore.gapToAbove}%</span> 차이</p>
                            : <p className="text-[10px] mt-0.5 font-bold" style={{ color: "#76C043" }}>🏆 1위!</p>}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 로그인 / 회원가입 */}
        <div className="bg-white rounded-3xl shadow-2xl p-6">
          <div className="flex gap-2 mb-6">
            <button onClick={() => { setMode("login"); setError(""); }}
              className="flex-1 py-2.5 rounded-2xl font-extrabold text-sm transition-all"
              style={mode === "login"
                ? { background: "#1F2A44", color: "#F6E27F" }
                : { background: "#f3f4f6", color: "#9ca3af" }}>
              로그인
            </button>
            <button onClick={() => { setMode("signup"); setError(""); }}
              className="flex-1 py-2.5 rounded-2xl font-extrabold text-sm transition-all"
              style={mode === "signup"
                ? { background: "#1F2A44", color: "#F6E27F" }
                : { background: "#f3f4f6", color: "#9ca3af" }}>
              처음 왔어요! 🙋
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
                className="w-full font-extrabold text-lg py-4 rounded-2xl shadow-lg transition-all active:scale-95 disabled:opacity-50"
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
                className="w-full font-extrabold text-lg py-4 rounded-2xl shadow-lg transition-all active:scale-95 disabled:opacity-50"
                style={{ background: "#76C043", color: "white" }}>
                {loading ? "등록 중... ✨" : "가입하고 시작하기! 🚀"}
              </button>
            </form>
          )}
        </div>

        {/* 선생님 로그인 */}
        <div className="text-center">
          <button onClick={() => router.push("/admin/login")} className="text-xs transition-all" style={{ color: "rgba(255,255,255,0.2)" }}>
            선생님 로그인
          </button>
        </div>
      </div>
    </div>
  );
}
