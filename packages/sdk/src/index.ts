export {
  SlotFlowClient,
  type SlotFlowClientConfig,
  type ListExecutionsQuery,
  type ListExecutionsResponse,
} from "./client.js";

// re-export core types for SDK consumer convenience
export type {
  SlotFlowPolicy,
  SlotFlowSendOptions,
  SlotFlowReceipt,
  ReceiptStatus,
  RouteKind,
  ConfirmationTarget,
} from "@slotflow/shared";
