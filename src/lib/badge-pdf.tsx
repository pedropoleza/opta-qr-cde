import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

// Crachá/etiqueta de credenciamento on-site (#4). A6 retrato, com a marca do
// tenant (cor/logo). Inclui um QR pequeno para sub-estações de scan.
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
};

function styles(brand: string) {
  return StyleSheet.create({
    page: { fontFamily: "Helvetica", color: "#101828", backgroundColor: "#fff" },
    band: {
      backgroundColor: brand,
      color: "#fff",
      paddingHorizontal: 20,
      paddingVertical: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    brandText: { fontFamily: "Helvetica-Bold", fontSize: 11 },
    eventText: { fontSize: 9, color: "#ffffff", opacity: 0.9, maxWidth: 180, textAlign: "right" },
    logo: { height: 18, objectFit: "contain" },
    body: {
      flexGrow: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 18,
      paddingVertical: 16,
    },
    label: { fontSize: 9, color: "#98a2b3", letterSpacing: 2, marginBottom: 6 },
    name: {
      fontFamily: "Helvetica-Bold",
      fontSize: 26,
      textAlign: "center",
      lineHeight: 1.15,
    },
    tier: {
      marginTop: 14,
      borderWidth: 2,
      borderColor: brand,
      color: brand,
      fontFamily: "Helvetica-Bold",
      fontSize: 12,
      paddingHorizontal: 14,
      paddingVertical: 4,
      borderRadius: 999,
    },
    session: { marginTop: 10, fontSize: 11, color: "#475467" },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: "#eaecf0",
    },
    date: { fontSize: 10, color: "#667085" },
    qr: { width: 56, height: 56 },
    madeBy: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      paddingBottom: 6,
    },
    madeByLogo: { width: 9, height: 9, objectFit: "contain", opacity: 0.7 },
    madeByText: { fontSize: 6.5, color: "#98a2b3", letterSpacing: 0.5 },
  });
}

function BadgeDoc({ data }: { data: BadgeData }) {
  const brand = data.brandColor || "#2563EB";
  const s = styles(brand);
  return (
    <Document title={`Crachá — ${data.guestName}`}>
      <Page size="A6" style={s.page}>
        <View style={s.band}>
          {data.logoUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={data.logoUrl} style={s.logo} />
          ) : (
            <Text style={s.brandText}>{data.brandName || "Spark Check-in"}</Text>
          )}
          <Text style={s.eventText}>{data.eventName}</Text>
        </View>

        <View style={s.body}>
          <Text style={s.label}>CREDENCIAL</Text>
          <Text style={s.name}>{data.guestName}</Text>
          {data.tier ? <Text style={s.tier}>{data.tier}</Text> : null}
          {data.sessionName ? (
            <Text style={s.session}>{data.sessionName}</Text>
          ) : null}
        </View>

        <View style={s.footer}>
          <Text style={s.date}>{data.eventDate}</Text>
          {data.qrDataUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={data.qrDataUrl} style={s.qr} />
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
