"use client";

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[100] bg-bg flex flex-col items-center justify-center gap-7">
      {/* Boosterpack with fill animation */}
      <div className="relative w-[140px] h-[192px]">
        {/* Glow rings */}
        <div className="absolute top-1/2 left-1/2 w-[160px] h-[210px] -ml-[80px] -mt-[105px] rounded-[14px] border border-pa-green pointer-events-none animate-[ring-pulse_3s_ease-in-out_infinite]" />
        <div className="absolute top-1/2 left-1/2 w-[190px] h-[240px] -ml-[95px] -mt-[120px] rounded-[18px] border border-pa-green pointer-events-none animate-[ring-pulse_3s_ease-in-out_0.12s_infinite]" />

        <svg viewBox="0 0 128 176" xmlns="http://www.w3.org/2000/svg" className="w-full h-full overflow-visible">
          <defs>
            <clipPath id="loadingInnerClip">
              <rect x="6" y="6" width="116" height="164" rx="8" ry="8" />
            </clipPath>
            <linearGradient id="loadingLiquidGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#9BFF00" stopOpacity="0.85" />
              <stop offset="30%" stopColor="#9BFF00" stopOpacity="0.55" />
              <stop offset="70%" stopColor="#7ACC00" stopOpacity="0.35" />
              <stop offset="95%" stopColor="#BFFF66" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="loadingBgGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#24043A" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#1A1924" />
              <stop offset="100%" stopColor="#24043A" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          {/* Pack body */}
          <g className="animate-[pack-glow_3s_cubic-bezier(0.4,0,0.2,1)_infinite]">
            <rect x="4" y="4" width="120" height="168" rx="10" ry="10" fill="#1A1924" stroke="#2D2C3D" strokeWidth="1.5" />
            <rect x="4" y="4" width="120" height="168" rx="10" ry="10" fill="none" stroke="#9BFF00" strokeWidth="1" opacity="0.3" />
          </g>

          {/* Inner background */}
          <rect x="6" y="6" width="116" height="164" rx="8" ry="8" fill="url(#loadingBgGrad)" />

          {/* Liquid clipped to pack */}
          <g clipPath="url(#loadingInnerClip)">
            <g className="animate-[fill-pulse_3s_cubic-bezier(0.4,0,0.2,1)_infinite]">
              <rect x="6" y="12" width="116" height="160" fill="url(#loadingLiquidGrad)" />
              <g className="animate-[wave_1.2s_ease-in-out_infinite]">
                <ellipse cx="64" cy="10" rx="62" ry="5" fill="#BFFF66" opacity="0.25" />
                <ellipse cx="64" cy="12" rx="58" ry="3" fill="#9BFF00" opacity="0.15" />
              </g>
            </g>

            {/* Bubbles */}
            <circle cx="32" cy="150" r="3" fill="rgba(191,255,102,0.5)" className="animate-[bubble1_2.4s_ease-out_0.2s_infinite]" />
            <circle cx="72" cy="145" r="2" fill="rgba(191,255,102,0.4)" className="animate-[bubble2_2.6s_ease-out_0.6s_infinite]" />
            <circle cx="50" cy="155" r="2.5" fill="rgba(155,255,0,0.5)" className="animate-[bubble1_2.2s_ease-out_1s_infinite]" />
            <circle cx="92" cy="148" r="1.5" fill="rgba(191,255,102,0.4)" className="animate-[bubble2_2.8s_ease-out_1.4s_infinite]" />
            <circle cx="42" cy="140" r="2" fill="rgba(155,255,0,0.4)" className="animate-[bubble1_2.3s_ease-out_0.4s_infinite]" />
          </g>

          {/* Flash overlay */}
          <rect x="6" y="6" width="116" height="164" rx="8" ry="8" fill="#9BFF00" className="animate-[flash_3s_ease-in-out_infinite]" />

          {/* Logo */}
          <g className="animate-[logo-glow_3s_ease-in-out_infinite]" transform="translate(14, 81) scale(0.4)">
            <g>
              <path d="M35.95,1.44h9.55l7.16,32.93h-8.4l-1.55-7.69h-9.99l-3.23,7.69h-9.02L35.95,1.44ZM41.7,21.15l-1.02-5.22c-.35-1.94-.71-3.58-.93-6.01-.84,2.43-1.77,4.24-2.52,6.01l-2.12,5.22h6.59Z" fill="#9bff00" />
            </g>
            <g>
              <path d="M51.85,19.3c0-10.08,7.69-18.26,17.42-18.26,5.17,0,9.24,2.03,10.74,4.42l-4.33,5.7c-1.15-1.5-3.09-2.83-6.45-2.83-5.13,0-8.89,4.33-8.89,11.4,0,5.3,2.92,8,6.98,8,3.18,0,5-1.41,6.23-2.74l3.05,5.92c-1.19,1.46-4.82,3.71-10.26,3.71-8.13,0-14.5-5.26-14.5-15.34Z" fill="#9bff00" />
            </g>
            <path d="M193.85,19.3c0-10.08,7.69-18.26,17.42-18.26,5.17,0,9.24,2.03,10.74,4.42l-4.33,5.7c-1.15-1.5-3.09-2.83-6.45-2.83-5.13,0-8.89,4.33-8.89,11.4,0,5.3,2.92,8,6.98,8,3.18,0,5-1.41,6.23-2.74l3.05,5.92c-1.19,1.46-4.82,3.71-10.25,3.71-8.13,0-14.5-5.26-14.5-15.34Z" fill="#9bff00" />
            <g>
              <path d="M87.97,17.31l-2.12,17.06h-8.71L81.2,1.44h8.71l-1.9,15.29,10.83-15.29h9.5l-11.63,15.47,8.71,17.46h-10.34l-7.12-17.06Z" fill="#9bff00" />
            </g>
            <g>
              <path d="M229.97,17.31l-2.12,17.06h-8.71l4.07-32.93h8.71l-1.9,15.29,10.83-15.29h9.5l-11.62,15.47,8.71,17.46h-10.34l-7.12-17.06Z" fill="#9bff00" />
            </g>
            <g>
              <path d="M120.7,1.44h9.55l7.16,32.93h-8.4l-1.55-7.69h-9.99l-3.23,7.69h-9.02L120.7,1.44ZM126.45,21.15l-1.02-5.22c-.35-1.94-.71-3.58-.93-6.01-.84,2.43-1.77,4.24-2.52,6.01l-2.12,5.22h6.59Z" fill="#9bff00" />
            </g>
            <g>
              <path d="M177.92,1.44h9.55l7.16,32.93h-8.4l-1.55-7.69h-9.99l-3.23,7.69h-9.02L177.92,1.44ZM183.67,21.15l-1.02-5.22c-.35-1.94-.71-3.58-.93-6.01-.84,2.43-1.77,4.24-2.52,6.01l-2.12,5.22h6.59Z" fill="#9bff00" />
            </g>
            <polygon points="145.81 34.37 149.73 1.4 135.82 1.4 134.84 9.53 142.89 9.53 140.06 34.37 145.81 34.37" fill="#9bff00" />
            <polygon points="158.78 1.4 154.24 34.37 160.1 34.37 162.89 9.53 171.11 9.53 172.04 1.4 158.78 1.4" fill="#9bff00" />
            <polygon points="159.54 .05 154.29 .33 157.07 3.66 153.43 6.39 156.29 9.86 152.65 12.58 155.59 16.08 151.9 18.75 154.9 22.27 151.18 25 154.12 28.5 150.48 31.19 155 35.93 159.54 .05" fill="#dfdfdf" />
            <polygon points="149.12 .05 153.79 3.18 150.12 5.97 153.04 9.51 149.41 12.18 152.33 15.68 148.66 18.39 151.62 21.89 147.96 24.64 150.87 28.05 147.12 30.89 150.25 34.55 144.87 35.68 149.12 .05" fill="#dfdfdf" />
            <g>
              <path d="M4.45,1.39l11.67.04c7.65,0,12.38,3.23,11.49,11.27-.8,7.29-6.45,10.7-14.23,10.7h-3.01l-1.37,10.96H.39L4.45,1.39ZM19.13,12.36c.4-3.09-1.68-4.07-3.98-4.11h-2.92l-1.1,8.75h2.17c3.01,0,5.35-.71,5.83-4.64Z" fill="#9bff00" />
            </g>
          </g>

          {/* Sparkles */}
          <circle cx="16" cy="12" r="3" fill="#9BFF00" className="animate-[sparkle-pop_3s_ease-out_infinite]" />
          <circle cx="112" cy="8" r="2.5" fill="#9BFF00" className="animate-[sparkle-pop_3s_ease-out_0.06s_infinite]" />
          <circle cx="8" cy="165" r="2" fill="#9BFF00" className="animate-[sparkle-pop_3s_ease-out_0.12s_infinite]" />
          <circle cx="120" cy="168" r="2.5" fill="#9BFF00" className="animate-[sparkle-pop_3s_ease-out_0.09s_infinite]" />
          <circle cx="4" cy="88" r="2" fill="#9BFF00" className="animate-[sparkle-pop_3s_ease-out_0.15s_infinite]" />
          <circle cx="124" cy="88" r="2" fill="#9BFF00" className="animate-[sparkle-pop_3s_ease-out_0.03s_infinite]" />
        </svg>
      </div>

      {/* Loading text */}
      <div className="flex items-center gap-1.5">
        <span className="text-[13px] text-text-muted uppercase tracking-[3px] font-medium">Loading</span>
        <span className="flex gap-[3px]">
          <span className="w-1 h-1 rounded-full bg-pa-green animate-[dot-bounce_1.4s_ease-in-out_infinite]" />
          <span className="w-1 h-1 rounded-full bg-pa-green animate-[dot-bounce_1.4s_ease-in-out_0.2s_infinite]" />
          <span className="w-1 h-1 rounded-full bg-pa-green animate-[dot-bounce_1.4s_ease-in-out_0.4s_infinite]" />
        </span>
      </div>

      <style>{`
        @keyframes pack-glow {
          0%, 10% { filter: drop-shadow(0 0 4px rgba(155,255,0,0.1)); }
          30%, 55% { filter: drop-shadow(0 0 24px rgba(155,255,0,0.5)) drop-shadow(0 0 48px rgba(155,255,0,0.15)); }
          75%, 85% { filter: drop-shadow(0 0 16px rgba(155,255,0,0.3)); }
          100% { filter: drop-shadow(0 0 4px rgba(155,255,0,0.1)); }
        }
        @keyframes fill-pulse {
          0%, 5% { transform: translateY(152px); }
          45%, 55% { transform: translateY(0px); }
          95%, 100% { transform: translateY(152px); }
        }
        @keyframes wave {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-3px); }
          75% { transform: translateX(3px); }
        }
        @keyframes flash {
          0%, 40% { opacity: 0; }
          50% { opacity: 0.25; }
          60% { opacity: 0; }
          100% { opacity: 0; }
        }
        @keyframes sparkle-pop {
          0%, 40% { opacity: 0; transform: scale(0.5); }
          50% { opacity: 1; transform: scale(1.8); }
          60% { opacity: 0.5; transform: scale(1.2); }
          70%, 100% { opacity: 0; transform: scale(0.5); }
        }
        @keyframes ring-pulse {
          0%, 42% { opacity: 0; transform: scale(0.9); }
          52% { opacity: 0.2; transform: scale(1.05); }
          62%, 100% { opacity: 0; transform: scale(1.15); }
        }
        @keyframes bubble1 {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 0.6; }
          80% { opacity: 0.2; }
          100% { transform: translateY(-120px); opacity: 0; }
        }
        @keyframes bubble2 {
          0% { transform: translateY(0); opacity: 0; }
          15% { opacity: 0.5; }
          75% { opacity: 0.15; }
          100% { transform: translateY(-110px); opacity: 0; }
        }
        @keyframes logo-glow {
          0%, 10% { opacity: 0.6; filter: drop-shadow(0 0 0 transparent); }
          45%, 55% { opacity: 1; filter: drop-shadow(0 0 6px rgba(155,255,0,0.4)); }
          90%, 100% { opacity: 0.6; filter: drop-shadow(0 0 0 transparent); }
        }
        @keyframes dot-bounce {
          0%, 80%, 100% { opacity: 0.3; transform: translateY(0); }
          40% { opacity: 1; transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}
