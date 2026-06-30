export const SUPPLIER_COLORS = {
  idox: '#1f6feb',
  landmark: '#f79009',
  esri: '#2da44e',
  other: '#8b5cf6',
  unknown: '#d1d5db',
};

export function getSupplierColor(supplier) {
  return SUPPLIER_COLORS[supplier] || SUPPLIER_COLORS.other;
}
