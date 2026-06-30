import './styles.css';
import { createBattlefieldScene } from './battlefield/scene.js';

const app = document.querySelector('#app');

app.innerHTML = `
  <header>
    <h1>Customer Battlefield Planner</h1>
  </header>
  <section class="controls">
    <label>
      Sector
      <select id="sector-filter"></select>
    </label>
    <label>
      Supplier
      <select id="supplier-filter"></select>
    </label>
  </section>
  <section class="layout">
    <div id="scene"></div>
    <aside id="details">
      <h2>Account details</h2>
      <p>Click a hex column to inspect customer details.</p>
    </aside>
  </section>
`;

createBattlefieldScene({
  container: document.querySelector('#scene'),
  detailPanel: document.querySelector('#details'),
  sectorFilter: document.querySelector('#sector-filter'),
  supplierFilter: document.querySelector('#supplier-filter'),
});
