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
  const BAR_COLORS = ["#F6E27F", "#B8D4F0", "#76C043"];

  return (
    <div className="min-h-screen" style={{ background: "#FFF9E6" }}>
      <div className="max-w-6xl mx-auto px-8 py-8">

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-5">
            <img src="/TheFluent/logo.clear.png" alt="The Fluent" style={{ height: "110px", objectFit: "contain" }} />
            <div style={{ width: "1px", height: "40px", background: "#E0D8C0" }} />
            <div>
              <h1 className="text-2xl font-black" style={{ color: "#1F2A44", lineHeight: 1.1 }}>단어 챌린지</h1>
              <p className="text-xs font-bold mt-0.5" style={{ color: "#76C043", letterSpacing: "1px" }}>영어 단어 왕은 누구?! 🏆</p>
            </div>
          </div>
          <button onClick={() => router.push("/admin/login")} className="text-xs transition-all" style={{ color: "#C0C8D8" }}>
            선생님 로그인
          </button>
        </div>

        {/* 2단 레이아웃 */}
        <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 360px", alignItems: "start" }}>

          {/* 왼쪽: 순위판 */}
          <div className="rounded-3xl p-6 bg-white" style={{ border: "1.5px solid #F0E8C8", boxShadow: "0 2px 12px rgba(246,226,127,0.2)" }}>
            <h2 className="font-black text-sm mb-4" style={{ color: "#1F2A44" }}>🏆 학년별 순위</h2>

            {/* 학년 탭 */}
            <div className="grid gap-2 mb-5" style={{ gridTemplateColumns: `repeat(${Math.max(rankings.length, 1)}, 1fr)` }}>
              {rankings.map((r, i) => (
                <button key={r.wordSetId} onClick={() => setGradeTab(i)}
                  className="rounded-xl font-extrabold transition-all"
                  style={{ position: "relative", height: "60px", overflow: "hidden",
                    ...(gradeTab === i
                      ? { background: "#1F2A44" }
                      : { background: "#ECEADE" }) }}>
                  <img src="/TheFluent/logo.symbol.png" alt=""
                    style={{ position: "absolute", width: "52px", height: "52px", objectFit: "contain",
                      bottom: "-6px", right: "-6px", opacity: gradeTab === i ? 0.55 : 0.28 }} />
                  <div style={{ position: "relative", zIndex: 1, lineHeight: 1 }}>
                    <div style={{ fontSize: "20px", fontWeight: 900, color: gradeTab === i ? "#F6E27F" : "#888888" }}>{r.name.replace("학년", "")}</div>
                    <div style={{ fontSize: "9px", fontWeight: 800, marginTop: "2px", color: gradeTab === i ? "rgba(246,226,127,0.7)" : "#AAAAAA" }}>학년</div>
                  </div>
                </button>
              ))}
            </div>

            {currentRanking && (
              <div>
                {/* 학습량 + 성적 나란히 */}
                <div className="grid grid-cols-2 gap-6">

                  {/* 학습량 */}
                  <div>
                    <p className="text-[10px] font-black mb-3 uppercase tracking-wide" style={{ color: "#76C043" }}>⚡ 학습량 TOP 3</p>
                    {currentRanking.volumeTop3.length === 0 ? (
                      <p className="text-xs py-2" style={{ color: "#CCCCCC" }}>아직 기록이 없어요!</p>
                    ) : (() => {
                      const max = currentRanking.volumeTop3[0]?.sessions ?? 1;
                      return (
                        <div className="space-y-3">
                          {currentRanking.volumeTop3.map((entry, i) => {
                            const pct = Math.round((entry.sessions / max) * 100);
                            const gap = i > 0 ? currentRanking.volumeTop3[0].sessions - entry.sessions : 0;
                            return (
                              <div key={entry.student?.id}>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="text-sm">{RANK_MEDALS[i]}</span>
                                  <span className="text-base">{entry.student?.avatar}</span>
                                  <span className="font-bold text-sm flex-1 truncate" style={{ color: "#1F2A44" }}>{entry.student?.name}</span>
                                  <span className="text-xs font-black" style={{ color: "#1F2A44" }}>{entry.sessions}회</span>
                                </div>
                                <div className="h-2 rounded-full overflow-hidden" style={{ background: "#F0ECE0" }}>
                                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: BAR_COLORS[i] }} />
                                </div>
                                {i > 0 && <p className="text-[10px] mt-0.5" style={{ color: "#AAAAAA" }}>▲ 1위와 {gap}회 차이</p>}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* 성적 */}
                  <div>
                    <p className="text-[10px] font-black mb-3 uppercase tracking-wide" style={{ color: "#76C043" }}>⭐ 성적 TOP 3</p>
                    {currentRanking.scoreTop3.length === 0 ? (
                      <p className="text-xs py-2" style={{ color: "#CCCCCC" }}>아직 기록이 없어요!</p>
                    ) : (() => {
                      const max = currentRanking.scoreTop3[0]?.avgAccuracy ?? 1;
                      return (
                        <div className="space-y-3">
                          {currentRanking.scoreTop3.map((entry, i) => {
                            const pct = Math.round((entry.avgAccuracy / max) * 100);
                            const gap = i > 0 ? currentRanking.scoreTop3[0].avgAccuracy - entry.avgAccuracy : 0;
                            return (
                              <div key={entry.student?.id}>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="text-sm">{RANK_MEDALS[i]}</span>
                                  <span className="text-base">{entry.student?.avatar}</span>
                                  <span className="font-bold text-sm flex-1 truncate" style={{ color: "#1F2A44" }}>{entry.student?.name}</span>
                                  <span className="text-xs font-black" style={{ color: "#1F2A44" }}>{entry.avgAccuracy}점</span>
                                </div>
                                <div className="h-2 rounded-full overflow-hidden" style={{ background: "#F0ECE0" }}>
                                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: BAR_COLORS[i] }} />
                                </div>
                                {i > 0 && <p className="text-[10px] mt-0.5" style={{ color: "#AAAAAA" }}>▲ 1위와 {gap}점 차이</p>}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* 내 순위 */}
                {myName && (currentRanking.myVolume || currentRanking.myScore) && (
                  <div className="mt-5 rounded-2xl p-4" style={{ background: "#FFFBEE", border: "1px solid #F0E8C8" }}>
                    <p className="text-[11px] font-black mb-3" style={{ color: "#1F2A44" }}>🙋 {myName}의 순위</p>
                    <div className="grid grid-cols-2 gap-3">
                      {currentRanking.myVolume && (
                        <div className="rounded-xl px-3 py-2.5 bg-white" style={{ border: "1px solid #F0E8C8" }}>
                          <p className="text-[10px] mb-0.5" style={{ color: "#AAAAAA" }}>⚡ 학습량</p>
                          <p className="font-black text-sm" style={{ color: "#1F2A44" }}>{currentRanking.myVolume.rank}위 <span style={{ color: "#C8A800" }}>{currentRanking.myVolume.sessions}회</span></p>
                          {currentRanking.myVolume.rank > 1
                            ? <p className="text-[10px] mt-0.5" style={{ color: "#AAAAAA" }}>윗 순위까지 <span style={{ color: "#C8A800", fontWeight: 800 }}>{currentRanking.myVolume.gapToAbove}회</span> 차이</p>
                            : <p className="text-[10px] mt-0.5 font-black" style={{ color: "#C8A800" }}>🏆 1위!</p>}
                        </div>
                      )}
                      {currentRanking.myScore && (
                        <div className="rounded-xl px-3 py-2.5 bg-white" style={{ border: "1px solid #D6EEC4" }}>
                          <p className="text-[10px] mb-0.5" style={{ color: "#AAAAAA" }}>⭐ 성적</p>
                          <p className="font-black text-sm" style={{ color: "#1F2A44" }}>{currentRanking.myScore.rank}위 <span style={{ color: "#4A9A1A" }}>{currentRanking.myScore.avgAccuracy}점</span></p>
                          {currentRanking.myScore.rank > 1
                            ? <p className="text-[10px] mt-0.5" style={{ color: "#AAAAAA" }}>윗 순위까지 <span style={{ color: "#4A9A1A", fontWeight: 800 }}>{currentRanking.myScore.gapToAbove}점</span> 차이</p>
                            : <p className="text-[10px] mt-0.5 font-black" style={{ color: "#4A9A1A" }}>🏆 1위!</p>}
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
          <div className="rounded-3xl p-7 bg-white" style={{ border: "1.5px solid #F0E8C8", boxShadow: "0 2px 12px rgba(246,226,127,0.2)" }}>
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
