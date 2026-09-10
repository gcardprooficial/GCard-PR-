// Tipos do módulo Placas & Avaliações (Fase 1). Espelham as tabelas
// plate_* da migration 0001_foundation.sql.

export type PlateFormat = "business_card" | "square_10" | "l_stand_10x15" | "other";
export type PlateTechnology = "qr" | "nfc" | "qr_nfc";

export type PlateProductType = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  format: PlateFormat;
  technology: PlateTechnology;
  unitPrice: number;
  active: boolean;
  comingSoon: boolean;   // aparece no catálogo mas não é pedível ainda
  stockQuantity: number | null;
  images: string[];
};

export type PlateOrderType = "individual" | "reseller";

export type PlateOrderStatus =
  | "draft"
  | "pending_payment"
  | "paid"
  | "processing"
  | "manufacturing"
  | "ready_to_ship"
  | "shipped"
  | "delivered"
  | "completed"
  | "cancelled"
  | "refunded";

export type PlatePaymentStatus = "pending" | "paid" | "failed" | "refunded";

export type PlateBatchStatus =
  | "reserved"
  | "manufacturing"
  | "in_stock"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PlateUnitStatus =
  | "reserved"
  | "manufacturing"
  | "in_stock"
  | "shipped"
  | "available_for_activation"
  | "activated"
  | "suspended"
  | "cancelled"
  | "blocked";

export type PlateDestinationType = "google_review" | "custom";

export type PlateOrder = {
  id: string;
  ownerProfileId: string;
  orderType: PlateOrderType;
  status: PlateOrderStatus;
  paymentStatus: PlatePaymentStatus;
  subtotal: number;
  shippingCost: number;
  discount: number;
  total: number;
  shippingSnapshot: PlateShippingSnapshot | null;
  customerNotes: string | null;
  provider: string | null;
  providerOrderId: string | null;
  trackingCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlateShippingSnapshot = {
  name: string;
  phone: string;
  address: string;
  cep: string;
  city?: string;
  state?: string;
  complement?: string;
};

export type PlateBatch = {
  id: string;
  batchCode: string;
  buyerProfileId: string;
  orderId: string;
  quantity: number;
  activatedQuantity: number;
  status: PlateBatchStatus;
  generatedAt: string | null;
  deliveredAt: string | null;
};

export type PlateUnit = {
  id: string;
  batchId: string | null;
  orderId: string;
  productTypeId: string;
  internalSerial: number;
  publicToken: string;
  activationCodeLast4: string | null;
  status: PlateUnitStatus;
  activatedAt: string | null;
  finalBusinessId: string | null;
};

export type PlateBusiness = {
  id: string;
  ownerProfileId: string;
  googlePlaceId: string | null;
  googleBusinessName: string | null;
  googleReviewUrl: string | null;
  businessName: string;
  category: string | null;
  logoUrl: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  status: "active" | "suspended";
};

// Item do catálogo já com a URL pública montada, pra usar no wizard.
export type PlateProductForSale = PlateProductType;
