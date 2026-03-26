"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

interface ErrorPageProps {
  code: string;
  title: string;
  description: string;
  /** Symbol that floats out of the pack: ?, !, ⚡, 🔒 etc */
  symbol?: string;
  /** Text shown inside the empty pack */
  packText?: string;
  showHomeButton?: boolean;
  showBackButton?: boolean;
  showRetry?: boolean;
  onRetry?: () => void;
}

export function ErrorPage({
  code,
  title,
  description,
  symbol = "?",
  packText = "EMPTY",
  showHomeButton = true,
  showBackButton = true,
  showRetry = false,
  onRetry,
}: ErrorPageProps) {
  const pathname = usePathname();
  const lang = pathname?.split("/")[1] || "en";

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 py-12">
      <div className="flex flex-col items-center gap-8 max-w-md">
        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/logo.svg"
          alt="PackAttack.gg"
          className="h-7 w-auto opacity-80"
        />

        {/* Animated pack */}
        <div className="relative w-[160px] h-[210px]">
          <svg viewBox="0 0 180 240" xmlns="http://www.w3.org/2000/svg" className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="errPackBg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#24043A" stopOpacity="0.4" />
                <stop offset="50%" stopColor="#1A1924" />
                <stop offset="100%" stopColor="#24043A" stopOpacity="0.2" />
              </linearGradient>
              <linearGradient id="errFlapGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#222131" />
                <stop offset="100%" stopColor="#1A1924" />
              </linearGradient>
            </defs>

            {/* Pack body */}
            <g className="animate-[err-glow_3s_ease-in-out_infinite]">
              <rect x="15" y="15" width="150" height="210" rx="12" ry="12" fill="#1A1924" stroke="#2D2C3D" strokeWidth="2" />
              <rect x="15" y="15" width="150" height="210" rx="12" ry="12" fill="none" stroke="#9BFF00" strokeWidth="1.2" opacity="0.2" />
            </g>

            {/* Inner area */}
            <rect x="22" y="70" width="136" height="148" rx="8" ry="8" fill="url(#errPackBg)" />

            {/* Pack inner text */}
            <text x="90" y="155" textAnchor="middle" fontWeight="800" fontSize="18" fill="#2D2C3D" fontFamily="sans-serif" letterSpacing="4" className="animate-[err-inner-pulse_4s_ease-in-out_infinite]">
              {packText}
            </text>

            {/* Tear line */}
            <line x1="15" y1="65" x2="165" y2="65" stroke="#9BFF00" strokeWidth="0.8" strokeDasharray="6 4" opacity="0.3" />

            {/* Top flap that opens */}
            <g className="animate-[err-flap_4s_cubic-bezier(0.4,0,0.2,1)_infinite]" style={{ transformOrigin: "90px 65px" }}>
              <path d="M15 65 L15 22 Q15 15 22 15 L158 15 Q165 15 165 22 L165 65 Z" fill="url(#errFlapGrad)" stroke="#2D2C3D" strokeWidth="2" />
              <path d="M15 65 L15 22 Q15 15 22 15 L158 15 Q165 15 165 22 L165 65 Z" fill="none" stroke="#9BFF00" strokeWidth="1" opacity="0.2" />
              <path d="M15 65 L30 57 L45 66 L60 58 L75 67 L90 57 L105 66 L120 58 L135 66 L150 58 L165 65" fill="none" stroke="#9BFF00" strokeWidth="1" opacity="0.4" />
            </g>

            {/* Symbol floating out */}
            <text x="90" y="40" textAnchor="middle" fontWeight="900" fontSize="36" fill="#9BFF00" fontFamily="sans-serif" className="animate-[err-float_4s_ease-out_infinite]">
              {symbol}
            </text>

            {/* Dust particles */}
            <circle cx="70" cy="58" r="2" fill="#9BFF00" className="animate-[err-dust1_4s_ease-out_0.2s_infinite]" />
            <circle cx="110" cy="55" r="1.5" fill="#BFFF66" className="animate-[err-dust2_4s_ease-out_0.3s_infinite]" />
            <circle cx="90" cy="52" r="2.5" fill="#9BFF00" className="animate-[err-dust3_4s_ease-out_0.1s_infinite]" />

            {/* Sparkles */}
            <circle cx="8" cy="50" r="2.5" fill="#9BFF00" className="animate-[err-spark_4s_ease-out_0.05s_infinite]" />
            <circle cx="172" cy="40" r="2" fill="#9BFF00" className="animate-[err-spark_4s_ease-out_0.1s_infinite]" />
            <circle cx="5" cy="200" r="2" fill="#9BFF00" className="animate-[err-spark_4s_ease-out_0.15s_infinite]" />
            <circle cx="175" cy="210" r="2.5" fill="#9BFF00" className="animate-[err-spark_4s_ease-out_0.08s_infinite]" />
          </svg>
        </div>

        {/* Error info */}
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-7xl sm:text-8xl font-black text-pa-green leading-none tracking-tight">
            {code}
          </h1>
          <h2 className="text-xl sm:text-2xl font-bold text-text-primary">
            {title}
          </h2>
          <p className="text-sm text-text-muted max-w-sm leading-relaxed">
            {description}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          {showBackButton && (
            <Button variant="secondary" size="md" onClick={() => window.history.back()}>
              Go back
            </Button>
          )}
          {showRetry && onRetry && (
            <Button variant="secondary" size="md" onClick={onRetry}>
              Try again
            </Button>
          )}
          {showHomeButton && (
            <Link href={`/${lang}/dashboard`}>
              <Button variant="primary" size="md">
                Back to Dashboard
              </Button>
            </Link>
          )}
        </div>
      </div>

      <style>{`
        @keyframes err-glow {
          0%, 100% { filter: drop-shadow(0 0 8px rgba(155,255,0,0.1)); }
          50% { filter: drop-shadow(0 0 20px rgba(155,255,0,0.25)); }
        }
        @keyframes err-flap {
          0%, 5% { transform: rotateX(0deg); }
          25%, 75% { transform: rotateX(-140deg); }
          95%, 100% { transform: rotateX(0deg); }
        }
        @keyframes err-float {
          0%, 10% { opacity: 0; transform: translateY(0) scale(0.5); }
          30% { opacity: 1; transform: translateY(-20px) scale(1); }
          55% { opacity: 1; transform: translateY(-35px) scale(1.05); }
          75% { opacity: 0.3; transform: translateY(-50px) scale(0.9); }
          90%, 100% { opacity: 0; transform: translateY(-60px) scale(0.7); }
        }
        @keyframes err-inner-pulse {
          0%, 10% { opacity: 0; }
          30%, 70% { opacity: 0.3; }
          90%, 100% { opacity: 0; }
        }
        @keyframes err-spark {
          0%, 15% { opacity: 0; transform: scale(0.3); }
          30% { opacity: 0.8; transform: scale(1.5); }
          50% { opacity: 0.4; transform: scale(1); }
          70%, 100% { opacity: 0; transform: scale(0.3); }
        }
        @keyframes err-dust1 {
          0%, 20% { opacity: 0; transform: translate(0,0); }
          35% { opacity: 0.5; }
          80%, 100% { opacity: 0; transform: translate(-25px,-40px); }
        }
        @keyframes err-dust2 {
          0%, 20% { opacity: 0; transform: translate(0,0); }
          35% { opacity: 0.4; }
          80%, 100% { opacity: 0; transform: translate(20px,-45px); }
        }
        @keyframes err-dust3 {
          0%, 20% { opacity: 0; transform: translate(0,0); }
          35% { opacity: 0.6; }
          80%, 100% { opacity: 0; transform: translate(-10px,-50px); }
        }
      `}</style>
    </div>
  );
}
