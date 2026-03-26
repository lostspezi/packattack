import "./globals.css";

export const metadata = {
  title: "404 — PackAttack.gg",
};

export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body style={{ background: "#12111A", color: "#C8C8D0", margin: 0, minHeight: "100vh", display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center", padding: "3rem 1rem", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>
        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/logo.svg" alt="PackAttack.gg" style={{ height: 28, marginBottom: 32, opacity: 0.8 }} />

        {/* Pack SVG */}
        <div style={{ width: 140, height: 185, marginBottom: 32 }}>
          <svg viewBox="0 0 180 240" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%", overflow: "visible" }}>
            <defs>
              <linearGradient id="gBg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#24043A" stopOpacity="0.4" />
                <stop offset="50%" stopColor="#1A1924" />
                <stop offset="100%" stopColor="#24043A" stopOpacity="0.2" />
              </linearGradient>
            </defs>
            <rect x="15" y="15" width="150" height="210" rx="12" ry="12" fill="#1A1924" stroke="#2D2C3D" strokeWidth="2" />
            <rect x="15" y="15" width="150" height="210" rx="12" ry="12" fill="none" stroke="#9BFF00" strokeWidth="1.2" opacity="0.2" />
            <rect x="22" y="70" width="136" height="148" rx="8" ry="8" fill="url(#gBg)" />
            <text x="90" y="155" textAnchor="middle" fontWeight="800" fontSize="18" fill="#2D2C3D" fontFamily="sans-serif" letterSpacing="4" opacity="0.3">EMPTY</text>
            <line x1="15" y1="65" x2="165" y2="65" stroke="#9BFF00" strokeWidth="0.8" strokeDasharray="6 4" opacity="0.3" />
            <path d="M15 65 L15 22 Q15 15 22 15 L158 15 Q165 15 165 22 L165 65 Z" fill="#222131" stroke="#2D2C3D" strokeWidth="2" style={{ transformOrigin: "90px 65px", animation: "gFlap 4s cubic-bezier(0.4,0,0.2,1) infinite" }} />
            <text x="90" y="40" textAnchor="middle" fontWeight="900" fontSize="36" fill="#9BFF00" fontFamily="sans-serif" style={{ animation: "gFloat 4s ease-out infinite" }}>?</text>
          </svg>
        </div>

        <h1 style={{ fontSize: "5rem", fontWeight: 900, color: "#9BFF00", lineHeight: 1, marginBottom: 8, letterSpacing: "-2px" }}>404</h1>
        <h2 style={{ fontSize: "1.35rem", fontWeight: 700, marginBottom: 8 }}>This pack is empty!</h2>
        <p style={{ fontSize: "0.875rem", color: "#6B6B78", textAlign: "center", maxWidth: "24rem", lineHeight: 1.6, marginBottom: 32 }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "12px 28px", background: "linear-gradient(135deg, #9BFF00, #85DD00)", color: "#12111A", fontWeight: 700, fontSize: "0.875rem", borderRadius: 10, textDecoration: "none" }}>
          Back to Home
        </a>

        <style>{`
          @keyframes gFlap {
            0%, 5% { transform: rotateX(0deg); }
            25%, 75% { transform: rotateX(-140deg); }
            95%, 100% { transform: rotateX(0deg); }
          }
          @keyframes gFloat {
            0%, 10% { opacity: 0; transform: translateY(0) scale(0.5); }
            30% { opacity: 1; transform: translateY(-20px) scale(1); }
            55% { opacity: 1; transform: translateY(-35px) scale(1.05); }
            75% { opacity: 0.3; transform: translateY(-50px) scale(0.9); }
            90%, 100% { opacity: 0; transform: translateY(-60px) scale(0.7); }
          }
        `}</style>
      </body>
    </html>
  );
}
