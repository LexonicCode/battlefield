import './styles.css';
import { createBattlefieldScene } from './battlefield/scene.js';

const app = document.querySelector('#app');

app.innerHTML = `
  <header>
    <h1>Customer Battlefield Planner</h1>
    <p>Interactive sector map using normalized customer records from the raw dataset.</p>
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
    <label class="search">
      Search account
      <input id="account-search" type="search" placeholder="Start typing an account name..." />
    </label>
    <div class="stats">
      <span id="record-count">0 / 0 visible</span>
    </div>
  </section>
  <section class="layout">
    <div id="scene"></div>
    <aside id="details">
      <h2>Account details</h2>
      <p class="hint">Click a hex column to inspect customer details.</p>
    </aside>
  </section>
`;

createBattlefieldScene({
  container: document.querySelector('#scene'),
  detailPanel: document.querySelector('#details'),
  sectorFilter: document.querySelector('#sector-filter'),
  supplierFilter: document.querySelector('#supplier-filter'),
  accountSearch: document.querySelector('#account-search'),
  recordCount: document.querySelector('#record-count'),
});
