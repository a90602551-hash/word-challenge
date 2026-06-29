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
}

export default function MainPage() {
  const router = useRouter();
  const [mode, setMode]         = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]         = useState("");
  const [avatar, setAvatar]     = useState("🐥");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [rankings, setRankings] = useState<GradeRanking[]>([]);
  const [gradeTab, setGradeTab] = useState(0);

  useEffect(() => {
    fetch("/api/rankings").then(r => r.json()).then(d => setRankings(d.rankings || [])).catch(() => {});
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
    if (!res.ok) { setError(data.error); return; }
    router.push("/challenge");
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, username, password, avatar }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error); return; }
    router.push("/placement");
  }

  const currentRanking = rankings[gradeTab];

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600">
      <div className="text-center pt-10 pb-4 px-4">
        <div className="text-6xl mb-2">🏆</div>
        <h1 className="text-4xl font-extrabold text-white drop-shadow-lg">단어 챌린지</h1>
        <p className="text-purple-200 mt-1 text-sm">영어 단어 왕은 누구?!</p>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-10 space-y-4">

        {/* 학년별 순위판 */}
        {rankings.length > 0 && (
          <div className="bg-white/15 backdrop-blur-sm rounded-3xl p-4 text-white">
            <h2 className="text-center font-extrabold text-base mb-3">📊 학년별 순위</h2>

            {/* 학년 탭 */}
            <div className="flex gap-2 mb-4">
              {rankings.map((r, i) => (
                <button key={r.wordSetId} onClick={() => setGradeTab(i)}
                  className={`flex-1 py-1.5 rounded-xl text-sm font-bold transition-all ${
                    gradeTab === i ? "bg-white text-violet-600" : "bg-white/20 text-white/80"
                  }`}>
                  {r.emoji} {r.name}
                </button>
              ))}
            </div>

            {currentRanking && (
              <div className="grid grid-cols-2 gap-3">
                {/* 학습량 */}
                <div className="bg-white/20 rounded-2xl p-3">
                  <p className="text-xs font-bold text-center text-purple-100 mb-2">⚡ 학습량 Top 3</p>
                  {currentRanking.volumeTop3.length === 0 ? (
                    <p className="text-center text-xs text-purple-200 py-2">아직 기록이 없어요!</p>
                  ) : (
                    <div className="space-y-2">
                      {currentRanking.volumeTop3.map(entry => (
                        <div key={entry.student?.id} className="flex items-center gap-2">
                          <span className="text-base">{RANK_MEDALS[entry.rank - 1]}</span>
                          <span className="text-lg">{entry.student?.avatar}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate">{entry.student?.name}</p>
                            <p className="text-xs text-purple-200">{entry.sessions}회 도전</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* 성적 */}
                <div className="bg-white/20 rounded-2xl p-3">
                  <p className="text-xs font-bold text-center text-purple-100 mb-2">⭐ 성적 Top 3</p>
                  {currentRanking.scoreTop3.length === 0 ? (
                    <p className="text-center text-xs text-purple-200 py-2">아직 기록이 없어요!</p>
                  ) : (
                    <div className="space-y-2">
                      {currentRanking.scoreTop3.map(entry => (
                        <div key={entry.student?.id} className="flex items-center gap-2">
                          <span className="text-base">{RANK_MEDALS[entry.rank - 1]}</span>
                          <span className="text-lg">{entry.student?.avatar}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate">{entry.student?.name}</p>
                            <p className="text-xs text-purple-200">평균 {entry.avgAccuracy}%</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 로그인 / 회원가입 */}
        <div className="bg-white rounded-3xl shadow-2xl p-6">
          {/* 탭 */}
          <div className="flex gap-2 mb-5">
            <button onClick={() => { setMode("login"); setError(""); }}
              className={`flex-1 py-2.5 rounded-2xl font-extrabold text-sm transition-all ${
                mode === "login" ? "bg-violet-500 text-white shadow" : "bg-gray-100 text-gray-400"
              }`}>
              로그인
            </button>
            <button onClick={() => { setMode("signup"); setError(""); }}
              className={`flex-1 py-2.5 rounded-2xl font-extrabold text-sm transition-all ${
                mode === "signup" ? "bg-violet-500 text-white shadow" : "bg-gray-100 text-gray-400"
              }`}>
              처음 왔어요! 🙋
            </button>
          </div>

          {mode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-sm font-bold text-gray-500 mb-1 block">아이디</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} required
                  placeholder="아이디를 입력하세요"
                  className="w-full border-2 border-gray-200 focus:border-purple-400 rounded-2xl px-4 py-3 text-lg outline-none transition-all" />
              </div>
              <div>
                <label className="text-sm font-bold text-gray-500 mb-1 block">비밀번호</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="비밀번호를 입력하세요"
                  className="w-full border-2 border-gray-200 focus:border-purple-400 rounded-2xl px-4 py-3 text-lg outline-none transition-all" />
              </div>
              {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-red-500 text-sm text-center">{error}</div>}
              <button type="submit" disabled={loading}
                className="w-full bg-gradient-to-r from-violet-500 to-indigo-500 text-white font-extrabold text-xl py-4 rounded-2xl shadow-lg transition-all disabled:opacity-50">
                {loading ? "로그인 중... ✨" : "시작하기! 🎮"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="text-sm font-bold text-gray-500 mb-1 block">이름</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required
                  placeholder="이름을 입력하세요"
                  className="w-full border-2 border-gray-200 focus:border-purple-400 rounded-2xl px-4 py-3 text-lg outline-none transition-all" />
              </div>
              <div>
                <label className="text-sm font-bold text-gray-500 mb-1 block">아이디</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} required
                  placeholder="사용할 아이디 (영문/숫자)"
                  className="w-full border-2 border-gray-200 focus:border-purple-400 rounded-2xl px-4 py-3 text-lg outline-none transition-all" />
              </div>
              <div>
                <label className="text-sm font-bold text-gray-500 mb-1 block">비밀번호</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="비밀번호 (4자 이상)"
                  className="w-full border-2 border-gray-200 focus:border-purple-400 rounded-2xl px-4 py-3 text-lg outline-none transition-all" />
              </div>
              <div>
                <label className="text-sm font-bold text-gray-500 mb-2 block">나를 나타낼 아바타 고르기</label>
                <div className="flex flex-wrap gap-2">
                  {AVATARS.map(a => (
                    <button key={a} type="button" onClick={() => setAvatar(a)}
                      className={`text-2xl w-11 h-11 rounded-xl transition-all ${avatar === a ? "bg-violet-100 ring-2 ring-violet-400 scale-110" : "bg-gray-50 hover:bg-gray-100"}`}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-red-500 text-sm text-center">{error}</div>}
              <button type="submit" disabled={loading}
                className="w-full bg-gradient-to-r from-violet-500 to-indigo-500 text-white font-extrabold text-xl py-4 rounded-2xl shadow-lg transition-all disabled:opacity-50">
                {loading ? "등록 중... ✨" : "가입하고 시작하기! 🚀"}
              </button>
            </form>
          )}
        </div>

        {/* 선생님 로그인 */}
        <div className="text-center">
          <button onClick={() => router.push("/admin/login")} className="text-white/40 hover:text-white/70 text-xs transition-all">
            선생님 로그인
          </button>
        </div>
      </div>
    </div>
  );
}
