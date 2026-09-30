import { ImageResponse } from "next/og";

export const alt = "TurnCreate — Turnos, CRM y caja para barberías, salones y centros de estética";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#FAFAFC",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 26,
              background: "#7069E8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                border: "7px dashed #FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#C4B5FD" }} />
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 88, fontWeight: 700, color: "#121217", letterSpacing: -2 }}>
            Turn<span style={{ color: "#7069E8" }}>Create</span>
          </div>
        </div>
        <div style={{ display: "flex", marginTop: 32, fontSize: 32, color: "#767582", textAlign: "center" }}>
          Turnos, CRM y caja para barberías, salones y centros de estética
        </div>
      </div>
    ),
    { ...size },
  );
}
