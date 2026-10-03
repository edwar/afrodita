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
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          borderRadius: 36,
          backgroundColor: "#F8F5F0",
          border: "4px solid #C9B99A",
          color: "#1A1A1A",
          fontFamily: "Georgia, Times New Roman, serif",
          fontSize: 132,
          lineHeight: 1,
        }}
      >
        A
        <div
          style={{
            position: "absolute",
            right: 24,
            top: 22,
            width: 14,
            height: 14,
            borderRadius: 14,
            backgroundColor: "#C9B99A",
            display: "flex",
          }}
        />
      </div>
    ),
    size
  )
}
