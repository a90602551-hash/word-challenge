"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const AVATARS = ["🐥", "🐶", "🐱", "🐰", "🐻", "🦊", "🐸", "🐧", "🦄", "🐯"];

interface RankStudent { id: number; name: string; avatar: string; }
interface VolumeEntry { rank: number; student: RankStudent; sessions: number; }
interface ScoreEntry  { rank: number; student: RankStudent; bestAccuracy: number; }

const RANK_MEDALS = ["🥇", "🥈", "🥉"];

export default function MainPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [volumeTop3, setVolumeTop3] = useState<VolumeEntry[]>([]);
  const [scoreTop3, setScoreTop3]   = useState<ScoreEntry[]>([]);

  useEffect(() => {
    fetch("/api/rankings").then(r => r.json()).then(d => {
      setVolumeTop3(d.volumeTop3 || []);
      setScoreTop3(d.scoreTop3 || []);
    }).catch(() => {});
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600">
      {/* 헤더 */}
      <div className="text-center pt-10 pb-6 px-4">
        <div className="text-7xl mb-3">🏆</div>
        <h1 className="text-4xl font-extrabold text-white drop-shadow-lg">단어 챌린지</h1>
        <p className="text-purple-200 mt-2 text-base">영어 단어 왕은 누구?!</p>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-10 space-y-5">
        {/* 순위판 */}
        <div className="bg-white/15 backdrop-blur-sm rounded-3xl p-5 text-white">
          <h2 className="text-center font-extrabold text-lg mb-4">📊 이번 주 순위</h2>
          <div className="grid grid-cols-2 gap-3">
            {/* 학습량 Top3 */}
            <div className="bg-white/20 rounded-2xl p-3">
              <p className="text-xs font-bold text-center text-purple-100 mb-2">⚡ 학습량 Top 3</p>
              {volumeTop3.length === 0 ? (
                <p className="text-center text-xs text-purple-200 py-2">아직 기록이 없어요!</p>
              ) : (
                <div className="space-y-2">
                  {volumeTop3.map((entry) => (
                    <div key={entry.student?.id} className="flex items-center gap-2">
                      <span className="text-lg">{RANK_MEDALS[entry.rank - 1]}</span>
                      <span className="text-xl">{entry.student?.avatar}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{entry.student?.name}</p>
                        <p className="text-xs text-purple-200">{entry.sessions}회 도전</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* 점수 Top3 */}
            <div className="bg-white/20 rounded-2xl p-3">
              <p className="text-xs font-bold text-center text-purple-100 mb-2">⭐ 점수 Top 3</p>
              {scoreTop3.length === 0 ? (
                <p className="text-center text-xs text-purple-200 py-2">아직 기록이 없어요!</p>
              ) : (
                <div className="space-y-2">
                  {scoreTop3.map((entry) => (
                    <div key={entry.student?.id} className="flex items-center gap-2">
                      <span className="text-lg">{RANK_MEDALS[entry.rank - 1]}</span>
                      <span className="text-xl">{entry.student?.avatar}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{entry.student?.name}</p>
                        <p className="text-xs text-purple-200">최고 {entry.bestAccuracy}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 로그인 */}
        <form onSubmit={handleLogin} className="bg-white rounded-3xl shadow-2xl p-6 space-y-4">
          <h2 className="text-center text-xl font-extrabold text-gray-800">로그인하고 도전하기! 🚀</h2>
          <div>
            <label className="text-sm font-bold text-gray-500 mb-1 block">🙋 아이디</label>
            <input
              type="text" value={username} onChange={e => setUsername(e.target.value)} required
              placeholder="아이디를 입력하세요"
              className="w-full border-2 border-gray-200 focus:border-purple-400 rounded-2xl px-4 py-3 text-lg outline-none transition-all"
            />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-500 mb-1 block">🔒 비밀번호</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required
              placeholder="비밀번호를 입력하세요"
              className="w-full border-2 border-gray-200 focus:border-purple-400 rounded-2xl px-4 py-3 text-lg outline-none transition-all"
            />
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-red-500 text-sm text-center">{error}</div>
          )}
          <button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white font-extrabold text-xl py-4 rounded-2xl shadow-lg transition-all disabled:opacity-50">
            {loading ? "로그인 중... ✨" : "시작하기! 🎮"}
          </button>
          <p className="text-center text-xs text-gray-400">아이디가 없으면 선생님께 물어보세요 😊</p>
        </form>

        {/* 아바타 장식 */}
        <div className="flex justify-center gap-3 text-3xl opacity-60">
          {AVATARS.slice(0, 6).map((a, i) => <span key={i}>{a}</span>)}
        </div>

        {/* 선생님 로그인 */}
        <div className="text-center">
          <button onClick={() => router.push("/admin/login")}
            className="text-white/50 hover:text-white/80 text-xs transition-all">
            선생님 로그인
          </button>
        </div>
      </div>
    </div>
  );
}
