import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import {
  type TicketConfig,
  type TicketMergeData,
  mergeFields,
} from "@/lib/ticket-template";
import { HeaderDecoration, PageBackground } from "@/lib/pdf-effects";
import { readableOn } from "@/lib/color";

const GOLD = "#C9A227";

export type TicketPdfData = TicketMergeData & {
  qrDataUrl: string;
  ticketUrl: string;
  sparkLogoUrl?: string | null; // selo discreto "feito com Spark"
  vip?: boolean; // arte VIP especial (#8)
};

function resolveTexts(data: TicketPdfData, config: TicketConfig) {
  const title = config.headerTitle
    ? mergeFields(config.headerTitle, data)
    : data.event.name;

  const subtitleParts: string[] = [];
  if (config.showTime) {
    subtitleParts.push(
      [data.event.date, data.event.time].filter(Boolean).join(" · "),
    );
  } else {
    subtitleParts.push(data.event.date);
  }
  if (config.showLocation && data.event.location) {
    subtitleParts.push(data.event.location);
  }
  const subtitle = config.subtitle
    ? mergeFields(config.subtitle, data)
    : subtitleParts.filter(Boolean).join("  ·  ");

  const instructions = mergeFields(config.instructions, data);
  return { title, subtitle, instructions };
}

function buildStyles(config: TicketConfig, vip: boolean) {
  const brand = vip ? GOLD : config.brandColor || "#2563EB";
  const modern = vip || config.preset !== "classic";
  const headerBg = vip ? "#15171C" : modern ? brand : "#ffffff";
  // Contraste automático: texto legível sobre o cabeçalho colorido.
  const headerText = vip ? GOLD : modern ? readableOn(brand) : "#101828";
  const headerMuted = vip ? "#CBD5E1" : modern ? readableOn(brand, "#475467", "#eaf0ff") : "#667085";
  return StyleSheet.create({
    page: {
      fontFamily: "Helvetica",
      color: "#101828",
      backgroundColor: "#ffffff",
    },
    header: {
      position: "relative",
      overflow: "hidden",
      backgroundColor: headerBg,
      color: modern ? "#ffffff" : "#101828",
      paddingHorizontal: 28,
      paddingVertical: config.preset === "compact" ? 18 : 26,
      borderBottomWidth: vip ? 2 : modern ? 0 : 3,
      borderBottomColor: vip ? GOLD : brand,
    },
    vipPill: {
      alignSelf: "flex-start",
      marginBottom: 8,
      backgroundColor: GOLD,
      color: "#1A1407",
      fontFamily: "Helvetica-Bold",
      fontSize: 10,
      letterSpacing: 1,
      paddingHorizontal: 10,
      paddingVertical: 2,
      borderRadius: 999,
    },
    logo: { height: 28, marginBottom: 10, objectFit: "contain" },
    title: {
      fontFamily: "Helvetica-Bold",
      fontSize: 20,
      lineHeight: 1.2,
      color: headerText,
    },
    subtitle: {
      fontSize: 11,
      marginTop: 6,
      color: headerMuted,
    },
    body: {
      paddingHorizontal: 28,
      paddingTop: 24,
      paddingBottom: 16,
      alignItems: "center",
    },
    guestLabel: { fontSize: 10, color: "#667085", letterSpacing: 1 },
    guestName: {
      fontFamily: "Helvetica-Bold",
      fontSize: 16,
      marginTop: 2,
      marginBottom: 16,
      textAlign: "center",
    },
    qrWrap: {
      borderWidth: 1,
      borderColor: "#eaecf0",
      borderRadius: 12,
      padding: 12,
      backgroundColor: "#ffffff",
    },
    qr: {
      width: config.preset === "compact" ? 150 : 200,
      height: config.preset === "compact" ? 150 : 200,
    },
    details: { marginTop: 16, alignItems: "center", gap: 2 },
    detailLine: { fontSize: 10, color: "#667085" },
    footer: {
      marginTop: "auto",
      paddingHorizontal: 28,
      paddingVertical: 16,
      borderTopWidth: 1,
      borderTopColor: "#eaecf0",
    },
    instructions: { fontSize: 10, color: "#475467", textAlign: "center" },
    link: {
      fontSize: 8,
      color: "#98a2b3",
      textAlign: "center",
      marginTop: 6,
    },
    madeBy: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      marginTop: 8,
    },
    madeByLogo: { width: 9, height: 9, objectFit: "contain", opacity: 0.7 },
    madeByText: { fontSize: 7, color: "#98a2b3", letterSpacing: 0.5 },
  });
}

function TicketDocument({
  data,
  config,
}: {
  data: TicketPdfData;
  config: TicketConfig;
}) {
  const vip = Boolean(data.vip);
  const s = buildStyles(config, vip);
  const { title, subtitle, instructions } = resolveTexts(data, config);

  return (
    <Document title={`Ingresso — ${data.event.name}`}>
      <Page size="A5" style={s.page}>
        {!vip && <PageBackground background={config.background} color={config.brandColor || "#101828"} />}
        <View style={s.header}>
          <HeaderDecoration
            effect={vip ? "halftone" : config.headerEffect}
            color={vip ? GOLD : "#ffffff"}
          />
          {config.logoUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={config.logoUrl} style={s.logo} />
          ) : null}
          {vip ? <Text style={s.vipPill}>★ VIP</Text> : null}
          <Text style={s.title}>{title}</Text>
          {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
        </View>

        <View style={s.body}>
          <Text style={s.guestLabel}>INGRESSO DE</Text>
          <Text style={s.guestName}>{data.contact.name}</Text>
          <View style={s.qrWrap}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={data.qrDataUrl} style={s.qr} />
          </View>
          <View style={s.details}>
            {config.showEmail && data.contact.email ? (
              <Text style={s.detailLine}>{data.contact.email}</Text>
            ) : null}
            {config.showPhone && data.contact.phone ? (
              <Text style={s.detailLine}>{data.contact.phone}</Text>
            ) : null}
          </View>
        </View>

        <View style={s.footer}>
          {instructions ? (
            <Text style={s.instructions}>{instructions}</Text>
          ) : null}
          <Text style={s.link}>{data.ticketUrl}</Text>
          {data.sparkLogoUrl ? (
            <View style={s.madeBy}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src={data.sparkLogoUrl} style={s.madeByLogo} />
              <Text style={s.madeByText}>feito com Spark</Text>
            </View>
          ) : null}
        </View>
      </Page>
    </Document>
  );
}

export async function renderTicketPdf(
  data: TicketPdfData,
  config: TicketConfig,
): Promise<Buffer> {
  return renderToBuffer(<TicketDocument data={data} config={config} />);
}
