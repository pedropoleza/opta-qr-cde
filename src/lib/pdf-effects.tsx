import { Svg, Rect, Circle, Defs, LinearGradient, Stop } from "@react-pdf/renderer";

// Efeitos decorativos para o cabeçalho dos PDFs (ingresso/crachá/certificado).
// Desenhados com Svg do @react-pdf, em camada absoluta atrás do conteúdo.
export type HeaderEffect = "none" | "bars" | "halftone" | "gradient";

const VB_W = 300;
const VB_H = 120;

function HalftoneDots({ color }: { color: string }) {
  const dots = [];
  const step = 13;
  for (let y = 0; y < VB_H + step; y += step) {
    for (let x = 0; x < VB_W + step; x += step) {
      // Cluster no canto superior direito → mais denso/opaco lá.
      const dx = (VB_W - x) / VB_W;
      const dy = y / VB_H;
      const t = Math.max(0, 1 - (dx + dy)); // 1 perto do topo-direita
      if (t <= 0.05) continue;
      dots.push(
        <Circle key={`${x}-${y}`} cx={x} cy={y} r={2.1} fill={color} opacity={0.06 + t * 0.22} />,
      );
    }
  }
  return <>{dots}</>;
}

function DiagonalBars({ color }: { color: string }) {
  // Faixas diagonais translúcidas (polígonos via Rect rotacionado).
  const bars = [];
  for (let i = -2; i < 8; i++) {
    const x = i * 44;
    bars.push(
      <Rect
        key={i}
        x={x}
        y={-20}
        width={14}
        height={VB_H + 40}
        fill={color}
        opacity={i % 2 === 0 ? 0.1 : 0.05}
        transform={`rotate(18 ${x} 0)`}
      />,
    );
  }
  return <>{bars}</>;
}

export type Background = "plain" | "dots" | "grid" | "gradient";

// Textura sutil de fundo do corpo (camada absoluta, renderizar antes do conteúdo).
export function PageBackground({
  background,
  color = "#101828",
}: {
  background: Background;
  color?: string;
}) {
  if (!background || background === "plain") return null;
  const W = 420;
  const H = 595;
  const items = [];
  if (background === "dots") {
    const step = 22;
    for (let y = step; y < H; y += step) {
      for (let x = step; x < W; x += step) {
        items.push(<Circle key={`${x}-${y}`} cx={x} cy={y} r={1.3} fill={color} opacity={0.06} />);
      }
    }
  } else if (background === "grid") {
    const step = 28;
    for (let x = step; x < W; x += step) {
      items.push(<Rect key={`v${x}`} x={x} y={0} width={0.6} height={H} fill={color} opacity={0.05} />);
    }
    for (let y = step; y < H; y += step) {
      items.push(<Rect key={`h${y}`} x={0} y={y} width={W} height={0.6} fill={color} opacity={0.05} />);
    }
  }
  return (
    <Svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {background === "gradient" ? (
        <>
          <Defs>
            <LinearGradient id="bg" x1="0" y1="0" x2="0.6" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.05} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={W} height={H} fill="url(#bg)" />
        </>
      ) : (
        items
      )}
    </Svg>
  );
}

export function HeaderDecoration({
  effect,
  color = "#ffffff",
}: {
  effect: HeaderEffect;
  color?: string;
}) {
  if (!effect || effect === "none") return null;
  return (
    <Svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {effect === "gradient" && (
        <>
          <Defs>
            <LinearGradient id="hg" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.0} />
              <Stop offset="1" stopColor={color} stopOpacity={0.25} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={VB_W} height={VB_H} fill="url(#hg)" />
        </>
      )}
      {effect === "halftone" && <HalftoneDots color={color} />}
      {effect === "bars" && <DiagonalBars color={color} />}
    </Svg>
  );
}
