import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

// Certificado de participação (#9). A4 paisagem, com a marca do tenant.
export type CertificateData = {
  guestName: string;
  eventName: string;
  eventDate: string;
  brandColor?: string | null;
  brandName?: string | null;
  logoUrl?: string | null;
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
      flexGrow: 1,
      borderWidth: 3,
      borderColor: brand,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 48,
      paddingVertical: 36,
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
  });
}

function CertificateDoc({ data }: { data: CertificateData }) {
  const brand = data.brandColor || "#2563EB";
  const s = styles(brand);
  return (
    <Document title={`Certificado — ${data.guestName}`}>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.frame}>
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
      </Page>
    </Document>
  );
}

export async function renderCertificatePdf(data: CertificateData): Promise<Buffer> {
  return renderToBuffer(<CertificateDoc data={data} />);
}
