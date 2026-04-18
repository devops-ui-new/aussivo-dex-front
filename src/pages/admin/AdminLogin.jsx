import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { API } from "../../config/api";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.status === 200) {
        localStorage.setItem("admin_token", data.data.token);
        toast.success("Login successful");
        navigate("/admin");
      } else toast.error(data.message);
    } catch { toast.error("Login failed"); }
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto px-6 py-20">
      <div className="glass p-8">
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center text-2xl">🔐</div>
          <h1 className="font-display font-bold text-2xl">Admin Panel</h1>
          <p className="text-muted text-sm mt-1">Aussivo.DEX Management</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-sm text-muted mb-1.5 block">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field" placeholder="admin@aussivo.com" required />
          </div>
          <div>
            <label className="text-sm text-muted mb-1.5 block">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input-field" placeholder="••••••" required />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 disabled:opacity-50">
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
