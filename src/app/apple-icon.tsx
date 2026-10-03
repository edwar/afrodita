import { ImageResponse } from "next/og"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          borderRadius: 36,
          backgroundColor: "#F8F5F0",
          border: "4px solid #C9B99A",
        }}
      >
        <svg
          width="180"
          height="180"
          viewBox="0 0 180 180"
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          <path
            d="M56 135 L90 45 L124 135"
            fill="none"
            stroke="#1A1A1A"
            strokeWidth="14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M70 109 L110 109"
            fill="none"
            stroke="#1A1A1A"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <path d="M131 32 L144 45 L131 58 L118 45 Z" fill="#C9B99A" />
        </svg>
      </div>
    ),
    size
  )
}
