import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GRID_CONFIG, SUPPLIER_COLORS } from '../config.js';
import { loadAccounts } from '../data/loadAccounts.js';
import { layoutGridByZone } from '../layout/gridLayout.js';
import { createColumnMesh } from './columnMesh.js';

function currency(value) {
  return `£${Math.round(value).toLocaleString()}`;
}

function applyLegend(container) {
  container.innerHTML = `
    <div><span class="legend-swatch" style="background:${SUPPLIER_COLORS.idox}"></span>Idox</div>
    <div><span class="legend-swatch" style="background:${SUPPLIER_COLORS.esri}"></span>ESRI</div>
    <div><span class="legend-swatch" style="background:${SUPPLIER_COLORS.landmark}"></span>Landmark</div>
    <div><span class="legend-swatch" style="background:${SUPPLIER_COLORS.os}"></span>Ordnance Survey / OS</div>
    <div><span class="legend-swatch" style="background:${SUPPLIER_COLORS.other}"></span>Other / Unknown</div>
  `;
}

function createZoneLabel(activity) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    return new THREE.Object3D();
  }
  canvas.width = 512;
  canvas.height = 128;
  context.fillStyle = 'rgba(255,255,255,0.92)';
  context.strokeStyle = '#cbd5e1';
  context.lineWidth = 3;
  context.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3);
  context.fillRect(1.5, 1.5, canvas.width - 3, canvas.height - 3);
  context.fillStyle = '#0f172a';
  context.font = 'bold 46px Inter, Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(activity, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(12, 3, 1);
  sprite.renderOrder = 10;
  return sprite;
}

function setTooltip(tooltip, data, x, y) {
  tooltip.style.display = 'block';
  tooltip.style.left = `${x + 12}px`;
  tooltip.style.top = `${y + 12}px`;
  tooltip.innerHTML = `
    <strong>${data.accountName}</strong><br/>
    Activity: ${data.companyActivity}<br/>
    Supplier: ${data.supplierRaw || 'Unknown'}<br/>
    Competitor: ${currency(data.competitorValue)}<br/>
    Upsell: ${currency(data.upsellValue)}<br/>
    Spend: ${currency(data.totalSpend)}<br/>
    <strong>Total: ${currency(data.computedTotalValue)}</strong>
  `;
}

export async function createBattlefieldScene({ container, legend, tooltip, stats }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f8fafc');

  const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 3000);
  camera.position.set(0, 95, 125);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = true;
  controls.enableZoom = true;
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.target.set(0, 0, 0);

  scene.add(new THREE.AmbientLight('#ffffff', 0.75));
  const directional = new THREE.DirectionalLight('#ffffff', 1.2);
  directional.position.set(30, 75, 40);
  scene.add(directional);

  const accounts = await loadAccounts();
  const positioned = layoutGridByZone(accounts, GRID_CONFIG);

  const spreadX = Math.max(...positioned.map((r) => Math.abs(r.x)), 1);
  const spreadZ = Math.max(...positioned.map((r) => Math.abs(r.z)), 1);
  const floorSize = Math.max(180, Math.ceil(Math.max(spreadX, spreadZ) * 2.6));
  scene.add(new THREE.GridHelper(floorSize, Math.min(220, GRID_CONFIG.targetCellsPerAxis), '#d1d5db', '#e5e7eb'));

  const meshes = [];
  for (const account of positioned) {
    const mesh = createColumnMesh({
      width: GRID_CONFIG.columnWidth,
      height: account.scaledHeight,
      color: account.colorHex,
    });
    mesh.position.x = account.x;
    mesh.position.z = account.z;
    mesh.userData = account;
    scene.add(mesh);
    meshes.push(mesh);
  }

  const zonesByActivity = new Map();
  for (const record of positioned) {
    if (!zonesByActivity.has(record.companyActivity)) {
      zonesByActivity.set(record.companyActivity, []);
    }
    zonesByActivity.get(record.companyActivity).push(record);
  }

  for (const [activity, records] of zonesByActivity.entries()) {
    const minX = Math.min(...records.map((record) => record.x));
    const maxX = Math.max(...records.map((record) => record.x));
    const minZ = Math.min(...records.map((record) => record.z));
    const maxHeight = Math.max(...records.map((record) => record.scaledHeight));
    const label = createZoneLabel(activity);
    label.position.set((minX + maxX) / 2, maxHeight + 1.5, minZ - 1.8);
    scene.add(label);
  }

  const zones = new Set(positioned.map((record) => record.companyActivity));
  stats.textContent = `${positioned.length.toLocaleString()} accounts across ${zones.size} activity zones`;
  applyLegend(legend);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let lockedId = null;

  function pick(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(meshes, false)[0];
    return hit?.object || null;
  }

  renderer.domElement.addEventListener('pointermove', (event) => {
    const hit = pick(event);
    renderer.domElement.style.cursor = hit ? 'pointer' : 'default';

    if (lockedId != null) {
      return;
    }

    if (!hit) {
      tooltip.style.display = 'none';
      return;
    }

    setTooltip(tooltip, hit.userData, event.clientX, event.clientY);
  });

  renderer.domElement.addEventListener('click', (event) => {
    const hit = pick(event);

    if (!hit) {
      lockedId = null;
      tooltip.style.display = 'none';
      return;
    }

    const data = hit.userData;
    lockedId = `${data.zoneKey}:${data.accountName}`;
    setTooltip(tooltip, data, event.clientX, event.clientY);
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      lockedId = null;
      tooltip.style.display = 'none';
    }
  });

  function animate() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  window.addEventListener('resize', () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  });

  animate();
}
