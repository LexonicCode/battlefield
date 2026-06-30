import * as THREE from 'three';

export function createHexColumn({ radius = 1, height = 1, color = '#d1d5db', opacity = 1, roughness = 0.45, metalness = 0.15 }) {
  const geometry = new THREE.CylinderGeometry(radius, radius, height, 6);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    transparent: opacity < 1,
    opacity,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = height / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
