import "./globals.css";

export const metadata = {
  title: "404 — PackAttack.gg",
};

export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body className="bg-[#12111A] text-[#C8C8D0] min-h-screen flex flex-col items-center justify-center px-4 py-12">
        {/* Animated pack */}
        <div className="relative w-24 h-32 mb-8">
          <svg viewBox="0 0 128 176" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <rect x="4" y="4" width="120" height="168" rx="10" ry="10" fill="#1A1924" stroke="#2D2C3D" strokeWidth="1.5" />
            <rect x="4" y="4" width="120" height="168" rx="10" ry="10" fill="none" stroke="#9BFF00" strokeWidth="1" opacity="0.2" />
            <text x="64" y="78" textAnchor="middle" fontWeight="900" fontSize="40" fill="#9BFF00" fontFamily="sans-serif" opacity="0.15">404</text>
            <g transform="translate(14, 81) scale(0.4)" opacity="0.5">
              <path d="M35.95,1.44h9.55l7.16,32.93h-8.4l-1.55-7.69h-9.99l-3.23,7.69h-9.02L35.95,1.44ZM41.7,21.15l-1.02-5.22c-.35-1.94-.71-3.58-.93-6.01-.84,2.43-1.77,4.24-2.52,6.01l-2.12,5.22h6.59Z" fill="#9bff00" />
              <path d="M51.85,19.3c0-10.08,7.69-18.26,17.42-18.26,5.17,0,9.24,2.03,10.74,4.42l-4.33,5.7c-1.15-1.5-3.09-2.83-6.45-2.83-5.13,0-8.89,4.33-8.89,11.4,0,5.3,2.92,8,6.98,8,3.18,0,5-1.41,6.23-2.74l3.05,5.92c-1.19,1.46-4.82,3.71-10.26,3.71-8.13,0-14.5-5.26-14.5-15.34Z" fill="#9bff00" />
              <path d="M193.85,19.3c0-10.08,7.69-18.26,17.42-18.26,5.17,0,9.24,2.03,10.74,4.42l-4.33,5.7c-1.15-1.5-3.09-2.83-6.45-2.83-5.13,0-8.89,4.33-8.89,11.4,0,5.3,2.92,8,6.98,8,3.18,0,5-1.41,6.23-2.74l3.05,5.92c-1.19,1.46-4.82,3.71-10.25,3.71-8.13,0-14.5-5.26-14.5-15.34Z" fill="#9bff00" />
              <path d="M87.97,17.31l-2.12,17.06h-8.71L81.2,1.44h8.71l-1.9,15.29,10.83-15.29h9.5l-11.63,15.47,8.71,17.46h-10.34l-7.12-17.06Z" fill="#9bff00" />
              <path d="M229.97,17.31l-2.12,17.06h-8.71l4.07-32.93h8.71l-1.9,15.29,10.83-15.29h9.5l-11.62,15.47,8.71,17.46h-10.34l-7.12-17.06Z" fill="#9bff00" />
              <path d="M120.7,1.44h9.55l7.16,32.93h-8.4l-1.55-7.69h-9.99l-3.23,7.69h-9.02L120.7,1.44ZM126.45,21.15l-1.02-5.22c-.35-1.94-.71-3.58-.93-6.01-.84,2.43-1.77,4.24-2.52,6.01l-2.12,5.22h6.59Z" fill="#9bff00" />
              <path d="M177.92,1.44h9.55l7.16,32.93h-8.4l-1.55-7.69h-9.99l-3.23,7.69h-9.02L177.92,1.44ZM183.67,21.15l-1.02-5.22c-.35-1.94-.71-3.58-.93-6.01-.84,2.43-1.77,4.24-2.52,6.01l-2.12,5.22h6.59Z" fill="#9bff00" />
              <polygon points="145.81 34.37 149.73 1.4 135.82 1.4 134.84 9.53 142.89 9.53 140.06 34.37 145.81 34.37" fill="#9bff00" />
              <polygon points="158.78 1.4 154.24 34.37 160.1 34.37 162.89 9.53 171.11 9.53 172.04 1.4 158.78 1.4" fill="#9bff00" />
              <polygon points="159.54 .05 154.29 .33 157.07 3.66 153.43 6.39 156.29 9.86 152.65 12.58 155.59 16.08 151.9 18.75 154.9 22.27 151.18 25 154.12 28.5 150.48 31.19 155 35.93 159.54 .05" fill="#dfdfdf" />
              <polygon points="149.12 .05 153.79 3.18 150.12 5.97 153.04 9.51 149.41 12.18 152.33 15.68 148.66 18.39 151.62 21.89 147.96 24.64 150.87 28.05 147.12 30.89 150.25 34.55 144.87 35.68 149.12 .05" fill="#dfdfdf" />
              <path d="M4.45,1.39l11.67.04c7.65,0,12.38,3.23,11.49,11.27-.8,7.29-6.45,10.7-14.23,10.7h-3.01l-1.37,10.96H.39L4.45,1.39ZM19.13,12.36c.4-3.09-1.68-4.07-3.98-4.11h-2.92l-1.1,8.75h2.17c3.01,0,5.35-.71,5.83-4.64Z" fill="#9bff00" />
            </g>
          </svg>
        </div>

        <h1 style={{ fontSize: "4rem", fontWeight: 900, color: "#9BFF00", marginBottom: "0.5rem", letterSpacing: "-0.02em" }}>
          404
        </h1>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>
          Page not found
        </h2>
        <p style={{ fontSize: "0.875rem", color: "#6B6B78", marginBottom: "2rem", textAlign: "center", maxWidth: "28rem" }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <a
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0.75rem 1.75rem",
            background: "#9BFF00",
            color: "#12111A",
            fontWeight: 700,
            fontSize: "0.875rem",
            borderRadius: "0.625rem",
            textDecoration: "none",
          }}
        >
          Back to Home
        </a>
      </body>
    </html>
  );
}
