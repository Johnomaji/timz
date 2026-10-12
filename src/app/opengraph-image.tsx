import { ImageResponse } from "next/og";

export const alt = "Vestage — diversified investing across real-world assets";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#06090f",
          padding: 80,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "linear-gradient(135deg, #10b981, #22d3ee)",
            }}
          />
          <div style={{ fontSize: 40, fontWeight: 600, color: "#e8eef9" }}>Vestage</div>
        </div>

        <div
          style={{
            marginTop: 56,
            fontSize: 68,
            fontWeight: 600,
            lineHeight: 1.1,
            letterSpacing: -2,
            color: "#e8eef9",
            maxWidth: 900,
          }}
        >
          Diversified investing across real-world assets.
        </div>

        <div style={{ marginTop: 28, fontSize: 30, color: "#8496b1", maxWidth: 820 }}>
          Fund in crypto, choose a term, and track your returns from one dashboard.
        </div>

        <div
          style={{
            marginTop: 56,
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 24,
            color: "#10b981",
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: 5, background: "#10b981" }} />
          vestage.io
        </div>
      </div>
    ),
    size,
  );
}
