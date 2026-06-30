import * as THREE from 'three';

export function createHexColumn({ radius = 1, height = 1, color = '#d1d5db' }) {
  const geometry = new THREE.CylinderGeometry(radius, radius, height, 6);
  const material = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = height / 2;
  return mesh;
}
