import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export function createColumnMesh({ width, height, color }) {
  const radius = Math.min(width * 0.2, 0.14);
  const geometry = new RoundedBoxGeometry(width, height, width, 5, radius);
  const material = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.3,
    metalness: 0.08,
    clearcoat: 0.7,
    clearcoatRoughness: 0.3,
    sheen: 0.35,
    sheenColor: new THREE.Color('#ffffff'),
    emissive: new THREE.Color(color).multiplyScalar(0.04),
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = height / 2;
  return mesh;
}
