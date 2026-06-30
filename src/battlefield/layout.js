const TERRITORY_CENTERS = {
  water: { x: -20, z: 0 },
  energy: { x: 0, z: 0 },
  fibre: { x: 20, z: 0 },
  gas: { x: -10, z: 20 },
  infrastructure: { x: 10, z: 20 },
  renewables: { x: 0, z: -20 },
  other: { x: 30, z: 20 },
};

export function getTerritoryCenter(sector) {
  return TERRITORY_CENTERS[sector] || TERRITORY_CENTERS.other;
}
