"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await fetch("/api/teacher/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error); return; }
    router.push("/admin");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center px-4">
      <form onSubmit={handleLogin} className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm space-y-5">
        <div className="text-center">
          <div className="text-5xl mb-3">👨‍🏫</div>
          <h1 className="text-2xl font-extrabold text-gray-800">선생님 로그인</h1>
          <p className="text-sm text-gray-400 mt-1">관리자 계정으로 로그인해주세요</p>
        </div>
        <div>
          <label className="text-sm font-bold text-gray-500 mb-1 block">이메일</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
            placeholder="이메일 주소"
            className="w-full border-2 border-gray-200 focus:border-slate-400 rounded-xl px-4 py-3 outline-none transition-all" />
        </div>
        <div>
          <label className="text-sm font-bold text-gray-500 mb-1 block">비밀번호</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
            placeholder="비밀번호"
            className="w-full border-2 border-gray-200 focus:border-slate-400 rounded-xl px-4 py-3 outline-none transition-all" />
        </div>
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full bg-slate-700 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-50">
          {loading ? "로그인 중..." : "로그인"}
        </button>
        <button type="button" onClick={() => router.push("/")} className="w-full text-gray-400 text-sm text-center">
          ← 학생 홈으로
        </button>
      </form>
    </div>
  );
}
