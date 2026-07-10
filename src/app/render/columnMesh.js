import * as THREE from 'three';

export function createColumnMesh({ width, height, color }) {
  const geometry = new THREE.BoxGeometry(width, height, width);
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.1 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = height / 2;
  return mesh;
}
