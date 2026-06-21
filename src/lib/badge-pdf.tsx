import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { HeaderDecoration, type HeaderEffect } from "@/lib/pdf-effects";
import { readableOn } from "@/lib/color";

// Crachá/etiqueta de credenciamento on-site (#4). A6 retrato, com a marca do
// tenant (cor/logo). Inclui um QR pequeno para sub-estações de scan.
// VIP (#8) recebe arte especial: tema escuro + dourado + halftone.
export type BadgeData = {
  guestName: string;
  eventName: string;
  eventDate: string;
  tier?: string | null;
  sessionName?: string | null;
  qrDataUrl?: string | null;
  brandColor?: string | null;
  brandName?: string | null;
  logoUrl?: string | null;
  sparkLogoUrl?: string | null; // selo discreto "feito com Spark"
  vip?: boolean;
  effect?: HeaderEffect;
};

const GOLD = "#C9A227";

function styles(brand: string, vip: boolean) {
  const bandBg = vip ? "#15171C" : brand;
  const accent = vip ? GOLD : brand;
  const bandText = vip ? GOLD : readableOn(brand);
  const bandMuted = vip ? "#ffffff" : readableOn(brand);
  return StyleSheet.create({
    page: {
      fontFamily: "Helvetica",
      color: vip ? "#F8FAFC" : "#101828",
      backgroundColor: vip ? "#0F1115" : "#fff",
    },
    band: {
      position: "relative",
      overflow: "hidden",
      backgroundColor: bandBg,
      color: "#fff",
      paddingHorizontal: 20,
      paddingVertical: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: vip ? 2 : 0,
      borderBottomColor: GOLD,
    },
    brandText: { fontFamily: "Helvetica-Bold", fontSize: 11, color: bandText },
    eventText: { fontSize: 9, color: bandMuted, opacity: 0.9, maxWidth: 170, textAlign: "right" },
    logo: { height: 18, objectFit: "contain" },
    body: {
      flexGrow: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 18,
      paddingVertical: 16,
    },
    vipPill: {
      marginBottom: 10,
      backgroundColor: GOLD,
      color: "#1A1407",
      fontFamily: "Helvetica-Bold",
      fontSize: 11,
      letterSpacing: 1,
      paddingHorizontal: 12,
      paddingVertical: 3,
      borderRadius: 999,
    },
    label: { fontSize: 9, color: vip ? GOLD : "#98a2b3", letterSpacing: 2, marginBottom: 6 },
    name: {
      fontFamily: "Helvetica-Bold",
      fontSize: 26,
      textAlign: "center",
      lineHeight: 1.15,
      color: vip ? "#FFFFFF" : "#101828",
    },
    tier: {
      marginTop: 14,
      borderWidth: 2,
      borderColor: accent,
      color: accent,
      fontFamily: "Helvetica-Bold",
      fontSize: 12,
      paddingHorizontal: 14,
      paddingVertical: 4,
      borderRadius: 999,
    },
    session: { marginTop: 10, fontSize: 11, color: vip ? "#CBD5E1" : "#475467" },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: vip ? "rgba(201,162,39,0.4)" : "#eaecf0",
    },
    date: { fontSize: 10, color: vip ? "#CBD5E1" : "#667085" },
    qrWrap: { backgroundColor: "#fff", borderRadius: 6, padding: vip ? 4 : 0 },
    qr: { width: 56, height: 56 },
    madeBy: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      paddingBottom: 6,
    },
    madeByLogo: { width: 9, height: 9, objectFit: "contain", opacity: 0.7 },
    madeByText: { fontSize: 6.5, color: vip ? "#94A3B8" : "#98a2b3", letterSpacing: 0.5 },
  });
}

function BadgeDoc({ data }: { data: BadgeData }) {
  const brand = data.brandColor || "#2563EB";
  const vip = Boolean(data.vip);
  const s = styles(brand, vip);
  const effect = vip ? "halftone" : data.effect ?? "none";
  const effectColor = vip ? GOLD : readableOn(brand);
  return (
    <Document title={`Crachá — ${data.guestName}`}>
      <Page size="A6" style={s.page}>
        <View style={s.band}>
          <HeaderDecoration effect={effect} color={effectColor} />
          {data.logoUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={data.logoUrl} style={s.logo} />
          ) : (
            <Text style={s.brandText}>{data.brandName || "Spark Check-in"}</Text>
          )}
          <Text style={s.eventText}>{data.eventName}</Text>
        </View>

        <View style={s.body}>
          {vip ? (
            <Text style={s.vipPill}>★ VIP</Text>
          ) : (
            <Text style={s.label}>CREDENCIAL</Text>
          )}
          <Text style={s.name}>{data.guestName}</Text>
          {data.tier && data.tier.trim().toLowerCase() !== "vip" ? (
            <Text style={s.tier}>{data.tier}</Text>
          ) : null}
          {data.sessionName ? (
            <Text style={s.session}>{data.sessionName}</Text>
          ) : null}
        </View>

        <View style={s.footer}>
          <Text style={s.date}>{data.eventDate}</Text>
          {data.qrDataUrl ? (
            <View style={s.qrWrap}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src={data.qrDataUrl} style={s.qr} />
            </View>
          ) : null}
        </View>

        {data.sparkLogoUrl ? (
          <View style={s.madeBy}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={data.sparkLogoUrl} style={s.madeByLogo} />
            <Text style={s.madeByText}>feito com Spark</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

export async function renderBadgePdf(data: BadgeData): Promise<Buffer> {
  return renderToBuffer(<BadgeDoc data={data} />);
}
