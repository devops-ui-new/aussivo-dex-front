import { useState, useEffect } from "react";
import { useWeb3 } from "../context/Web3Context";
import toast from "react-hot-toast";

/**
 * Registration modal — ONLY shown for new users.
 * Returning users are auto-logged-in via wallet-auth (no modal needed).
 * 
 * Flow: Enter Email → OTP → Done
 * (Wallet is already connected at this point via Navbar)
 */
export default function AuthModal({ onClose }) {
  const { account, short, sendOTP, verifyOTP } = useWeb3();
  const [step, setStep] = useState("register"); // register → otp
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) setReferralCode(ref);
  }, []);

  const handleSendOTP = async () => {
    if (!email) { toast.error("Enter your email"); return; }
    setLoading(true);
    try {
      const res = await sendOTP(email, name, referralCode);
      if (res.status === 200) { setStep("otp"); toast.success("OTP sent to your email!"); }
      else toast.error(res.message);
    } catch { toast.error("Failed to send OTP"); }
    setLoading(false);
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) { toast.error("Enter 6-digit OTP"); return; }
    setLoading(true);
    try {
      const res = await verifyOTP(email, otp);
      if (res.status === 200) { toast.success("Welcome to Aussivo.DEX!"); onClose(); }
      else toast.error(res.message);
    } catch { toast.error("Verification failed"); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative glass w-full max-w-md mx-4 p-0 overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ animation: "modalIn 0.25s ease-out" }}>

        <div className="flex items-center justify-between p-5 border-b border-surface-4/50">
          <div>
            <h2 className="font-display font-bold text-lg text-white">{step === "register" ? "Create Account" : "Verify Email"}</h2>
            <p className="text-xs text-muted mt-0.5">One-time setup — you won't need to do this again</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-surface-3/80 flex items-center justify-center text-muted hover:text-white">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="flex gap-1 px-5 pt-4">
          <div className={`h-1 flex-1 rounded-full ${step === "register" || step === "otp" ? "bg-brand" : "bg-surface-4"}`} />
          <div className={`h-1 flex-1 rounded-full ${step === "otp" ? "bg-brand" : "bg-surface-4"}`} />
        </div>

        <div className="p-5">
          {step === "register" && (
            <div className="space-y-4">
              {account && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-brand/5 border border-brand/15">
                  <div className="pulse-dot" />
                  <div>
                    <div className="text-xs text-muted">Wallet Connected</div>
                    <div className="text-sm font-mono text-brand">{short}</div>
                  </div>
                  <span className="ml-auto text-xs text-brand bg-brand/10 px-2 py-0.5 rounded-full">✓ Connected</span>
                </div>
              )}
              <div>
                <label className="text-sm text-muted mb-1.5 block">Email Address *</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="input-field" autoFocus />
                <p className="text-[11px] text-muted mt-1">We'll send a one-time verification code</p>
              </div>
              <div>
                <label className="text-sm text-muted mb-1.5 block">Your Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="John Doe (optional)" className="input-field" />
              </div>
              <div>
                <label className="text-sm text-muted mb-1.5 block">Referral Code</label>
                <input type="text" value={referralCode} onChange={e => setReferralCode(e.target.value)} placeholder="AUSX7K9M (optional)" className="input-field" />
              </div>
              <button onClick={handleSendOTP} disabled={loading || !email} className="btn-primary w-full py-3.5 disabled:opacity-50">
                {loading ? "Sending..." : "Send Verification Code"}
              </button>
            </div>
          )}

          {step === "otp" && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00e676" strokeWidth="1.8"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7"/></svg>
                </div>
                <p className="text-sm text-muted">Code sent to</p>
                <p className="text-sm font-semibold text-white">{email}</p>
              </div>
              <div>
                <input type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000" className="input-field text-center text-2xl font-display font-bold tracking-[12px]" maxLength={6} autoFocus />
                <p className="text-[11px] text-muted mt-1.5 text-center">Dev mode: use code <strong className="text-brand">123456</strong></p>
              </div>
              <button onClick={handleVerifyOTP} disabled={loading || otp.length !== 6} className="btn-primary w-full py-3.5 disabled:opacity-50">
                {loading ? "Verifying..." : "Verify & Create Account"}
              </button>
              <div className="flex items-center justify-between">
                <button onClick={() => { setStep("register"); setOtp(""); }} className="text-xs text-muted hover:text-slate-300">← Change email</button>
                <button onClick={handleSendOTP} disabled={loading} className="text-xs text-brand hover:underline">Resend code</button>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 pb-5">
          <div className="bg-surface-2/30 rounded-xl p-3 text-center">
            <p className="text-[11px] text-muted">After this one-time setup, you'll auto-login every time you connect your wallet.</p>
          </div>
        </div>
      </div>
      <style>{`@keyframes modalIn { from { opacity:0; transform:scale(0.95) translateY(10px); } to { opacity:1; transform:scale(1) translateY(0); } }`}</style>
    </div>
  );
}
