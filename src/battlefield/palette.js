export const SUPPLIER_COLORS = {
  idox: '#1f6feb',
  landmark: '#f79009',
  esri: '#2da44e',
  ordnance_survey: '#8b5cf6',
  other: '#facc15',
  unknown: '#9ca3af',
};

export function getSupplierColor(supplier) {
  return SUPPLIER_COLORS[supplier] || SUPPLIER_COLORS.other;
}
