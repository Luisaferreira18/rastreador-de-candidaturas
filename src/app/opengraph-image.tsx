import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getStage, type StageKey } from "@/lib/stages";

/**
 * Imagem que aparece quando o link do app é compartilhado (WhatsApp, LinkedIn,
 * Slack...). Gerada no build, com as mesmas cores e a mesma fonte do site.
 */

export const alt = "Rastreador de candidaturas: quadro Kanban com as candidaturas em cada etapa do processo seletivo";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// As cores do tema claro do site (globals.css), em hexadecimal.
const COLORS = {
  background: "#fcfdfe",
  foreground: "#15151a",
  muted: "#737373",
  border: "#e5e5e5",
  card: "#ffffff",
  primary: "#5252d8",
};

const fontsDir = join(process.cwd(), "assets/fonts");
const [geistRegular, geistSemiBold] = await Promise.all([
  readFile(join(fontsDir, "Geist-Regular.ttf")),
  readFile(join(fontsDir, "Geist-SemiBold.ttf")),
]);

type MiniCard = { company: string; role: string; jobType: string; tint: [number, number, number]; ink: string };

const COLUMNS: { stage: StageKey; count: number; cards: MiniCard[] }[] = [
  {
    stage: "enviada",
    count: 3,
    cards: [
      { company: "Nuvem Pay", role: "Estágio em Dados", jobType: "Estágio", tint: [59, 130, 246], ink: "#1d4ed8" },
      { company: "Atlas Seguros", role: "Analista Júnior de BI", jobType: "CLT", tint: [139, 92, 246], ink: "#6d28d9" },
      { company: "Pixel Studio", role: "Estágio em Design", jobType: "Estágio", tint: [244, 63, 94], ink: "#be123c" },
    ],
  },
  {
    stage: "entrevista_rh",
    count: 2,
    cards: [
      { company: "Banco Aurora", role: "Estágio em Software", jobType: "Estágio", tint: [16, 185, 129], ink: "#047857" },
      { company: "Lumen Saúde", role: "Trainee de Produto", jobType: "Trainee", tint: [245, 158, 11], ink: "#b45309" },
    ],
  },
  {
    stage: "proposta",
    count: 1,
    cards: [
      { company: "Horizonte Energia", role: "Estágio em Finanças", jobType: "Estágio", tint: [6, 182, 212], ink: "#0e7490" },
    ],
  },
];

function rgba([r, g, b]: [number, number, number], alpha: number) {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function initials(name: string) {
  const words = name.split(" ");
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase();
}

function Card({ card }: { card: MiniCard }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 16,
        borderRadius: 14,
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        boxShadow: "0 1px 3px rgba(21, 21, 26, 0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: 8,
            background: rgba(card.tint, 0.12),
            color: card.ink,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {initials(card.company)}
        </div>
        <div style={{ display: "flex", fontSize: 18, fontWeight: 600, color: COLORS.foreground }}>{card.company}</div>
      </div>
      <div style={{ display: "flex", fontSize: 16, color: COLORS.muted }}>{card.role}</div>
      <div style={{ display: "flex" }}>
        <div
          style={{
            display: "flex",
            padding: "3px 8px",
            borderRadius: 6,
            border: `1px solid ${COLORS.border}`,
            fontSize: 13,
            color: COLORS.muted,
          }}
        >
          {card.jobType}
        </div>
      </div>
    </div>
  );
}

function Column({ stage, count, cards }: (typeof COLUMNS)[number]) {
  const { label, hex } = getStage(stage);
  const rgb = hexToRgb(hex);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        width: 250,
        flexShrink: 0,
        padding: 12,
        borderRadius: 18,
        background: rgba(rgb, 0.07),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 4px" }}>
        <div style={{ display: "flex", width: 10, height: 10, borderRadius: 999, background: hex }} />
        <div style={{ display: "flex", fontSize: 15, fontWeight: 600, color: COLORS.foreground }}>{label}</div>
        <div
          style={{
            display: "flex",
            marginLeft: "auto",
            padding: "1px 8px",
            borderRadius: 999,
            background: "rgba(21, 21, 26, 0.06)",
            fontSize: 13,
            color: COLORS.muted,
          }}
        >
          {String(count)}
        </div>
      </div>
      {cards.map((card) => (
        <Card key={card.company} card={card} />
      ))}
    </div>
  );
}

function LogoMark() {
  const bar = (height: number, opacity: number) => (
    <div style={{ display: "flex", width: 6, height, borderRadius: 999, background: `rgba(255, 255, 255, ${opacity})` }} />
  );
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        gap: 6,
        width: 56,
        height: 56,
        padding: 13,
        borderRadius: 15,
        background: COLORS.primary,
        boxShadow: "0 2px 6px rgba(82, 82, 216, 0.35)",
      }}
    >
      {bar(26, 0.95)}
      {bar(18, 0.7)}
      {bar(30, 0.95)}
    </div>
  );
}

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: COLORS.background,
          backgroundImage: "radial-gradient(circle at 88% 12%, rgba(82, 82, 216, 0.10), rgba(82, 82, 216, 0) 55%)",
          fontFamily: "Geist",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Texto */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: 560,
            padding: "68px 0 60px 72px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <LogoMark />
            <div style={{ display: "flex", fontSize: 30, fontWeight: 600, color: COLORS.foreground, letterSpacing: -0.5 }}>
              Rastreador
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div
              style={{
                display: "flex",
                fontSize: 66,
                fontWeight: 600,
                lineHeight: 1.04,
                letterSpacing: -2,
                color: COLORS.foreground,
              }}
            >
              Rastreador de candidaturas
            </div>
            <div style={{ display: "flex", fontSize: 27, lineHeight: 1.35, color: COLORS.muted, maxWidth: 440 }}>
              Do envio à proposta: Kanban, prazos e métricas das suas candidaturas.
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 20, color: COLORS.muted }}>rastreador-de-candidaturas.vercel.app</div>
        </div>

        {/* Mini Kanban, saindo pela borda direita */}
        <div style={{ display: "flex", gap: 16, position: "absolute", left: 592, top: 70 }}>
          {COLUMNS.map((column) => (
            <Column key={column.stage} {...column} />
          ))}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist", data: geistRegular, weight: 400, style: "normal" },
        { name: "Geist", data: geistSemiBold, weight: 600, style: "normal" },
      ],
    },
  );
}
