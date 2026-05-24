export const REGIONS = {
  SG: {
    label: "🇸🇬 Singapore",
    currency: "SGD",
    methods: ["card", "paynow", "grabpay"],
  },
  US: {
    label: "🇺🇸 United States",
    currency: "USD",
    methods: ["card", "cashapp", "link"],
  },
  TH: {
    label: "🇹🇭 Thailand",
    currency: "THB",
    methods: ["card", "promptpay"],
  },
  MY: {
    label: "🇲🇾 Malaysia",
    currency: "MYR",
    methods: ["card", "fpx", "grabpay"],
  },
} as const;

export type RegionCode = keyof typeof REGIONS;

export function isRegionCode(value: unknown): value is RegionCode {
  return typeof value === "string" && value in REGIONS;
}
