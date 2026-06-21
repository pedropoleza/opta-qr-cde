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
  HeaderDecoration,
  PageBackground,
  type HeaderEffect,
  type Background,
} from "@/lib/pdf-effects";

// Certificado de participação (#9). A4 paisagem, com a marca do tenant + tema.
export type CertificateData = {
  guestName: string;
  eventName: string;
  eventDate: string;
  brandColor?: string | null;
  brandName?: string | null;
  logoUrl?: string | null;
  sparkLogoUrl?: string | null; // selo discreto "feito com Spark"
  headerEffect?: HeaderEffect;
  background?: Background;
};

function styles(brand: string) {
  return StyleSheet.create({
    page: {
      fontFamily: "Helvetica",
      color: "#101828",
      backgroundColor: "#ffffff",
      padding: 28,
    },
    frame: {
      position: "relative",
      overflow: "hidden",
      flexGrow: 1,
      borderWidth: 3,
      borderColor: brand,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 48,
      paddingVertical: 36,
    },
    topBar: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 16,
      backgroundColor: brand,
    },
    logo: { height: 34, objectFit: "contain", marginBottom: 14 },
    brand: { fontSize: 12, letterSpacing: 2, color: brand, marginBottom: 6 },
    title: {
      fontFamily: "Helvetica-Bold",
      fontSize: 30,
      letterSpacing: 1,
      marginBottom: 18,
      textAlign: "center",
    },
    intro: { fontSize: 12, color: "#475467", marginBottom: 8 },
    name: {
      fontFamily: "Helvetica-Bold",
      fontSize: 26,
      marginVertical: 8,
      textAlign: "center",
    },
    line: { fontSize: 13, color: "#344054", textAlign: "center", lineHeight: 1.5 },
    rule: { width: 220, borderBottomWidth: 1, borderBottomColor: "#d0d5dd", marginVertical: 14 },
    footer: { marginTop: 22, fontSize: 11, color: "#667085" },
    madeBy: {
      position: "absolute",
      bottom: 16,
      left: 0,
      right: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    madeByLogo: { width: 11, height: 11, objectFit: "contain", opacity: 0.7 },
    madeByText: { fontSize: 7.5, color: "#98a2b3", letterSpacing: 0.5 },
  });
}

function CertificateDoc({ data }: { data: CertificateData }) {
  const brand = data.brandColor || "#2563EB";
  const s = styles(brand);
  return (
    <Document title={`Certificado — ${data.guestName}`}>
      <Page size="A4" orientation="landscape" style={s.page}>
        <PageBackground background={data.background ?? "plain"} color={brand} />
        <View style={s.frame}>
          <View style={s.topBar}>
            <HeaderDecoration effect={data.headerEffect ?? "none"} color="#ffffff" />
          </View>
          {data.logoUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={data.logoUrl} style={s.logo} />
          ) : (
            <Text style={s.brand}>{(data.brandName || "SPARK CHECK-IN").toUpperCase()}</Text>
          )}
          <Text style={s.title}>CERTIFICADO DE PARTICIPAÇÃO</Text>
          <Text style={s.intro}>Certificamos que</Text>
          <Text style={s.name}>{data.guestName}</Text>
          <View style={s.rule} />
          <Text style={s.line}>
            participou do evento <Text style={{ fontFamily: "Helvetica-Bold" }}>{data.eventName}</Text>,
          </Text>
          <Text style={s.line}>realizado em {data.eventDate}.</Text>
          <Text style={s.footer}>
            Emitido por {data.brandName || "Spark Check-in"}
          </Text>
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

export async function renderCertificatePdf(data: CertificateData): Promise<Buffer> {
  return renderToBuffer(<CertificateDoc data={data} />);
}
