import { ImageResponse } from "next/og"

export const alt = "Afrodita — tu estilo, hecho con lo que ya tienes"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const runtime = "edge"

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: "#F8F5F0",
          color: "#1A1A1A",
          padding: "56px 72px",
          fontFamily: "Georgia, Times New Roman, serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 24,
            top: 24,
            right: 24,
            bottom: 24,
            border: "1px solid #C9B99A",
            display: "flex",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: 760,
            zIndex: 1,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <span style={{ fontSize: 43, letterSpacing: "-2px" }}>Afrodita</span>
            <span
              style={{
                fontFamily: "Arial, sans-serif",
                fontSize: 13,
                letterSpacing: "4px",
                color: "#6B6B6B",
              }}
            >
              ESTILO PERSONAL CON IA
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ fontSize: 75, lineHeight: 0.98, letterSpacing: "-3px" }}>
              Tu estilo,
              <div style={{ fontStyle: "italic", color: "#6B6B6B" }}>
                hecho con lo que ya tienes.
              </div>
            </div>
            <div
              style={{
                fontFamily: "Arial, sans-serif",
                fontSize: 21,
                color: "#6B6B6B",
                letterSpacing: "0.2px",
              }}
            >
              Tu closet. Nuevas combinaciones. Tu decisión.
            </div>
          </div>
          <div
            style={{
              width: 58,
              height: 3,
              backgroundColor: "#C9B99A",
              display: "flex",
            }}
          />
        </div>
        <div
          style={{
            position: "absolute",
            right: 74,
            top: 104,
            width: 264,
            height: 420,
            backgroundColor: "#1A1A1A",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 186,
              height: 322,
              border: "1px solid #C9B99A",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#F8F5F0",
              fontSize: 154,
              lineHeight: 1,
            }}
          >
            A
          </div>
          <div
            style={{
              position: "absolute",
              right: 32,
              bottom: 28,
              width: 8,
              height: 8,
              borderRadius: 8,
              backgroundColor: "#C9B99A",
              display: "flex",
            }}
          />
        </div>
      </div>
    ),
    size
  )
}
