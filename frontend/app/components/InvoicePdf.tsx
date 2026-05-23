"use client";

import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { InvoiceData, formatDate, formatMoney } from "@/app/lib/invoice";

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontSize: 10,
    color: "#18181b",
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: "#e4e4e7",
    paddingBottom: 16,
    marginBottom: 24,
  },
  brandCol: {
    alignItems: "flex-start",
  },
  brandLogo: {
    width: 300,
    height: 110,
    objectFit: "contain",
    objectPositionX: 0,
    alignSelf: "flex-start",
    marginLeft: -19,
    marginBottom: -8,
  },
  brandSub: {
    fontSize: 9,
    color: "#71717a",
    marginTop: 4,
    alignSelf: "flex-start",
  },
  title: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
    letterSpacing: 1,
  },
  meta: {
    marginTop: 6,
    textAlign: "right",
    fontSize: 9,
    color: "#52525b",
  },
  metaValue: {
    color: "#18181b",
    fontFamily: "Helvetica-Bold",
  },
  twoCol: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  block: {
    width: "48%",
  },
  blockLabel: {
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#71717a",
    marginBottom: 6,
  },
  clientName: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  clientEmail: {
    fontSize: 10,
    color: "#52525b",
  },
  table: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e4e4e7",
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e4e4e7",
    backgroundColor: "#fafafa",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 12,
  },
  th: {
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#71717a",
  },
  thDesc: { flex: 1, paddingHorizontal: 10 },
  thAmount: { width: 110, paddingHorizontal: 10, textAlign: "right" },
  tdDesc: { flex: 1, paddingHorizontal: 10, fontSize: 10 },
  tdAmount: {
    width: 110,
    paddingHorizontal: 10,
    textAlign: "right",
    fontSize: 10,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
  },
  totalsBlock: {
    width: 220,
  },
  totalsLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  totalsLabel: { fontSize: 10, color: "#52525b" },
  totalsValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#18181b",
    marginTop: 4,
  },
  totalLabel: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  totalValue: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  footer: {
    marginTop: "auto",
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#e4e4e7",
    fontSize: 9,
    color: "#71717a",
    lineHeight: 1.5,
  },
});

export function InvoicePdf({ data }: { data: InvoiceData }) {
  const moneyTotal = formatMoney(data.amount, data.currency);
  const lineLabel = data.description?.trim() || "Services rendered";

  return (
    <Document
      title={`Invoice ${data.invoice_number}`}
      author="ClearLedge"
      subject={`Invoice for ${data.client_name}`}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brandCol}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image has no alt prop */}
            <Image src="/logo/default-no-bg-removebg-preview.png" style={styles.brandLogo} />
            <Text style={styles.brandSub}>Treasury reconciliation</Text>
          </View>
          <View>
            <Text style={styles.title}>INVOICE</Text>
            <Text style={styles.meta}>
              No. <Text style={styles.metaValue}>{data.invoice_number}</Text>
            </Text>
            <Text style={styles.meta}>
              Issued{" "}
              <Text style={styles.metaValue}>
                {formatDate(data.issued_at)}
              </Text>
            </Text>
            <Text style={styles.meta}>
              Due{" "}
              <Text style={styles.metaValue}>{formatDate(data.due_date)}</Text>
            </Text>
          </View>
        </View>

        <View style={styles.twoCol}>
          <View style={styles.block}>
            <Text style={styles.blockLabel}>Bill to</Text>
            <Text style={styles.clientName}>{data.client_name}</Text>
            <Text style={styles.clientEmail}>{data.client_email}</Text>
          </View>
          <View style={styles.block}>
            <Text style={styles.blockLabel}>Pay in</Text>
            <Text style={styles.clientName}>{data.currency}</Text>
            <Text style={styles.clientEmail}>
              Payment link sent via email
            </Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.thDesc]}>Description</Text>
            <Text style={[styles.th, styles.thAmount]}>Amount</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tdDesc}>{lineLabel}</Text>
            <Text style={styles.tdAmount}>{moneyTotal}</Text>
          </View>
        </View>

        <View style={styles.totalsRow}>
          <View style={styles.totalsBlock}>
            <View style={styles.totalsLine}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>{moneyTotal}</Text>
            </View>
            <View style={styles.totalLine}>
              <Text style={styles.totalLabel}>Total due</Text>
              <Text style={styles.totalValue}>{moneyTotal}</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>
            Please settle this invoice by {formatDate(data.due_date)} using the
            payment link provided in your email.
          </Text>
          <Text>
            Questions about this invoice? Reply to the email it was sent from.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
