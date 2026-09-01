const DATA_URL = "data/portfolio.json";
const GEO_URL = "data/cod-adm1.geojson";

const THEME_COLORS = {
  "Protection des femmes et des filles": "#d11f73",
  "Consolidation de la paix et relèvement": "#17a673",
  "Appui institutionnel": "#2388c9",
};
const SERIES_COLORS = ["#2388c9", "#17a673", "#d11f73", "#ed9f24", "#6d5bd0"];
const GEO_NAME_MAP = { "North Kivu": "Nord-Kivu", "South Kivu": "Sud-Kivu", Ituri: "Ituri" };
const TARGET_PROVINCES = ["Ituri", "Nord-Kivu", "Sud-Kivu"];

const state = {
  data: null,
  geojson: null,
  filters: { outcome: "", province: "", theme: "", status: "" },
  mapMetric: "budget",
  map: null,
  geoLayer: null,
  charts: {},
};

const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const integer = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 });

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" }[character]));
}

function compactMoney(value) {
  if (value >= 1_000_000) return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value / 1_000_000)} M$`;
  if (value >= 1_000) return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value / 1_000)} k$`;
  return money.format(value);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
}

function aggregate(rows, key) {
  return rows.reduce((result, row) => {
    const label = row[key] || "Non précisé";
    result[label] ??= { label, projects: 0, budget: 0, ebola: 0, partners: new Set() };
    result[label].projects += 1;
    result[label].budget += Number(row.budget || 0);
    result[label].ebola += Number(row.ebola || 0);
    result[label].partners.add(row.partner);
    return result;
  }, {});
}

function filteredRows() {
  const { outcome, province, theme, status } = state.filters;
  return state.data.portfolio.filter((row) =>
    (!outcome || row.outcome === outcome) &&
    (!province || row.province === province) &&
    (!theme || row.theme === theme) &&
    (!status || row.status === status)
  );
}

function populateSelect(id, values) {
  const select = document.getElementById(id);
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
}

function initializeFilters() {
  const rows = state.data.portfolio;
  populateSelect("filter-outcome", unique(rows.map((row) => row.outcome)));
  populateSelect("filter-province", unique(rows.map((row) => row.province)));
  populateSelect("filter-theme", unique(rows.map((row) => row.theme)));
  populateSelect("filter-status", unique(rows.map((row) => row.status)));

  const bindings = {
    "filter-outcome": "outcome",
    "filter-province": "province",
    "filter-theme": "theme",
    "filter-status": "status",
  };
  Object.entries(bindings).forEach(([id, filter]) => {
    document.getElementById(id).addEventListener("change", (event) => {
      state.filters[filter] = event.target.value;
      updateAll();
    });
  });

  document.getElementById("reset-filters").addEventListener("click", () => {
    state.filters = { outcome: "", province: "", theme: "", status: "" };
    Object.keys(bindings).forEach((id) => { document.getElementById(id).value = ""; });
    updateAll();
  });
}

function updateHero() {
  const rows = state.data.portfolio;
  const totalBudget = rows.reduce((sum, row) => sum + row.budget, 0);
  const totalEbola = rows.reduce((sum, row) => sum + row.ebola, 0);
  document.querySelector('[data-hero-kpi="partners"]').textContent = integer.format(new Set(rows.map((row) => row.partner)).size);
  document.querySelector('[data-hero-kpi="budget"]').textContent = compactMoney(totalBudget);
  document.querySelector('[data-hero-kpi="provinces"]').textContent = integer.format(new Set(rows.map((row) => row.province)).size);
  document.querySelector('[data-hero-kpi="ebola"]').textContent = compactMoney(totalEbola);

  const themes = aggregate(rows, "theme");
  const capacity = themes["Appui institutionnel"] || { projects: 0, budget: 0 };
  const peace = themes["Consolidation de la paix et relèvement"] || { projects: 0, budget: 0 };
  const protection = themes["Protection des femmes et des filles"] || { projects: 0, budget: 0 };
  document.getElementById("effect-partners").textContent = `${rows.length} partenaires`;
  document.getElementById("effect-capacity").textContent = `${capacity.projects} projets`;
  document.getElementById("effect-ebola").textContent = compactMoney(totalEbola);
  document.getElementById("story-protection").textContent = `${protection.projects} projets · ${compactMoney(protection.budget)}`;
  document.getElementById("story-peace").textContent = `${peace.projects} projets · ${compactMoney(peace.budget)}`;
  document.getElementById("story-capacity").textContent = `${capacity.projects} projets · ${compactMoney(capacity.budget)}`;
}

function updateKpis(rows) {
  const projects = rows.length;
  const partners = new Set(rows.map((row) => row.partner)).size;
  const budget = rows.reduce((sum, row) => sum + row.budget, 0);
  const ebola = rows.reduce((sum, row) => sum + row.ebola, 0);
  const activeFilters = Object.values(state.filters).filter(Boolean);
  document.getElementById("kpi-projects").textContent = integer.format(projects);
  document.getElementById("kpi-partners").textContent = integer.format(partners);
  document.getElementById("kpi-budget").textContent = compactMoney(budget);
  document.getElementById("kpi-ebola").textContent = compactMoney(ebola);
  document.getElementById("kpi-ebola-share").textContent = `${percent.format(budget ? ebola / budget : 0)} du budget filtré`;
  document.getElementById("kpi-filter-label").textContent = activeFilters.length ? `${activeFilters.length} filtre(s) actif(s)` : "Portefeuille complet";
}

function provinceStats(rows) {
  const stats = aggregate(rows, "province");
  TARGET_PROVINCES.forEach((province) => {
    stats[province] ??= { label: province, projects: 0, budget: 0, ebola: 0, partners: new Set() };
  });
  return stats;
}

function metricValue(item, metric) {
  if (metric === "projects") return item.projects;
  return item[metric] || 0;
}

function rampColor(value, max, isTarget) {
  if (!isTarget) return "#dfe7ed";
  if (!max || value <= 0) return "#d7edf7";
  const ratio = value / max;
  if (ratio < .35) return "#a9d5e9";
  if (ratio < .65) return "#5eb0d6";
  if (ratio < .85) return "#2388c9";
  return "#165f9b";
}

function mapTooltip(province, item) {
  return `<div class="map-tooltip"><strong>${escapeHtml(province)}</strong><dl><dt>Projets</dt><dd>${integer.format(item.projects)}</dd><dt>Partenaires</dt><dd>${integer.format(item.partners.size)}</dd><dt>Budget</dt><dd>${compactMoney(item.budget)}</dd><dt>Ebola</dt><dd>${compactMoney(item.ebola)}</dd></dl></div>`;
}

function updateMap(rows) {
  const stats = provinceStats(rows);
  const maximum = Math.max(...TARGET_PROVINCES.map((province) => metricValue(stats[province], state.mapMetric)), 0);
  if (state.geoLayer) state.geoLayer.remove();
  state.geoLayer = L.geoJSON(state.geojson, {
    style: (feature) => {
      const rawName = feature.properties.shapeName;
      const name = GEO_NAME_MAP[rawName] || rawName;
      const isTarget = TARGET_PROVINCES.includes(name);
      const selected = state.filters.province === name;
      return {
        color: selected ? "#d11f73" : "#ffffff",
        weight: selected ? 3 : .85,
        fillColor: rampColor(metricValue(stats[name] || {}, state.mapMetric), maximum, isTarget),
        fillOpacity: isTarget ? .93 : .65,
        opacity: 1,
      };
    },
    onEachFeature: (feature, layer) => {
      const rawName = feature.properties.shapeName;
      const province = GEO_NAME_MAP[rawName] || rawName;
      if (!TARGET_PROVINCES.includes(province)) return;
      layer.bindTooltip(mapTooltip(province, stats[province]), { sticky: true, direction: "top", className: "wphf-tooltip" });
      layer.on({
        mouseover: () => layer.setStyle({ weight: 3, color: "#8edff6" }),
        mouseout: () => state.geoLayer.resetStyle(layer),
        click: () => {
          state.filters.province = province;
          document.getElementById("filter-province").value = province;
          updateAll();
        },
      });
    },
  }).addTo(state.map);

  const targetLayers = [];
  state.geoLayer.eachLayer((layer) => {
    const rawName = layer.feature?.properties?.shapeName;
    const name = GEO_NAME_MAP[rawName] || rawName;
    if (TARGET_PROVINCES.includes(name)) targetLayers.push(layer);
  });
  if (!state.map._wphfBoundsSet && targetLayers.length) {
    const group = L.featureGroup(targetLayers);
    state.map.fitBounds(group.getBounds(), { padding: [22, 22] });
    state.map._wphfBoundsSet = true;
  }

  const metricLabels = { budget: "Budget", projects: "Nombre de projets", ebola: "Contribution Ebola" };
  document.getElementById("map-legend").innerHTML = `<strong>${metricLabels[state.mapMetric]}</strong><span>Faible</span><span class="legend-ramp"><i style="background:#d7edf7"></i><i style="background:#a9d5e9"></i><i style="background:#5eb0d6"></i><i style="background:#2388c9"></i><i style="background:#165f9b"></i></span><span>Élevé</span>`;
  renderProvinceRank(stats);
}

function renderProvinceRank(stats) {
  const rows = TARGET_PROVINCES.map((province) => stats[province]).sort((a, b) => b.budget - a.budget);
  const maximum = Math.max(...rows.map((row) => row.budget), 1);
  document.getElementById("province-rank").innerHTML = rows.map((row) => `
    <div class="province-row" data-province="${escapeHtml(row.label)}" tabindex="0" role="button" aria-label="Filtrer sur ${escapeHtml(row.label)}">
      <div class="province-row-head"><strong>${escapeHtml(row.label)}</strong><span>${compactMoney(row.budget)}</span></div>
      <div class="progress"><i style="width:${(row.budget / maximum) * 100}%"></i></div>
      <div class="province-row-meta"><span>${integer.format(row.projects)} projet(s)</span><span>${compactMoney(row.ebola)} Ebola</span></div>
    </div>
  `).join("");
  document.querySelectorAll(".province-row").forEach((element) => {
    const choose = () => {
      state.filters.province = element.dataset.province;
      document.getElementById("filter-province").value = element.dataset.province;
      updateAll();
    };
    element.addEventListener("click", choose);
    element.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") choose(); });
  });
}

function chartData(rows, key, value = "budget") {
  const grouped = aggregate(rows, key);
  return Object.values(grouped)
    .map((item) => ({ label: item.label, value: value === "projects" ? item.projects : item[value] }))
    .sort((a, b) => b.value - a.value);
}

function createOrReplaceChart(id, config) {
  state.charts[id]?.destroy();
  const context = document.getElementById(id).getContext("2d");
  state.charts[id] = new Chart(context, config);
}

function commonOptions(horizontal = false) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? "y" : "x",
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (context) => context.dataset.metric === "money" ? money.format(context.raw) : integer.format(context.raw) } },
    },
    scales: {
      x: { grid: { display: horizontal, color: "#e8eef3" }, border: { display: false }, ticks: { color: "#617187", font: { family: "DM Sans", size: 10 }, callback: horizontal ? (value) => compactMoney(value) : undefined } },
      y: { grid: { display: !horizontal, color: "#e8eef3" }, border: { display: false }, ticks: { color: "#617187", font: { family: "DM Sans", size: 10 }, callback: !horizontal ? (value) => compactMoney(value) : undefined } },
    },
  };
}

function updateCharts(rows) {
  const theme = chartData(rows, "theme");
  createOrReplaceChart("theme-chart", {
    type: "bar",
    data: { labels: theme.map((item) => item.label), datasets: [{ data: theme.map((item) => item.value), backgroundColor: theme.map((item) => THEME_COLORS[item.label] || "#2388c9"), borderRadius: 7, metric: "money" }] },
    options: commonOptions(true),
  });

  const province = chartData(rows, "province");
  createOrReplaceChart("province-chart", {
    type: "bar",
    data: { labels: province.map((item) => item.label), datasets: [{ data: province.map((item) => item.value), backgroundColor: ["#165f9b", "#2388c9", "#75bfde"], borderRadius: 7, metric: "money" }] },
    options: commonOptions(false),
  });

  const status = chartData(rows, "status", "projects");
  createOrReplaceChart("status-chart", {
    type: "doughnut",
    data: { labels: status.map((item) => item.label), datasets: [{ data: status.map((item) => item.value), backgroundColor: ["#17a673", "#ed9f24", "#d11f73"], borderColor: "#fff", borderWidth: 4, hoverOffset: 5, metric: "count" }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: "66%", plugins: { legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8, color: "#617187", font: { family: "DM Sans", size: 11 } } }, tooltip: { callbacks: { label: (context) => `${context.label}: ${integer.format(context.raw)} projet(s)` } } } },
  });

  const outcome = chartData(rows, "outcome", "projects");
  createOrReplaceChart("outcome-chart", {
    type: "doughnut",
    data: { labels: outcome.map((item) => item.label), datasets: [{ data: outcome.map((item) => item.value), backgroundColor: SERIES_COLORS, borderColor: "#fff", borderWidth: 4, hoverOffset: 5, metric: "count" }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: "66%", plugins: { legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8, color: "#617187", font: { family: "DM Sans", size: 11 } } }, tooltip: { callbacks: { label: (context) => `${context.label}: ${integer.format(context.raw)} projet(s)` } } } },
  });
}

function badgeColor(value) {
  const colors = ["#d11f73", "#2388c9", "#17a673", "#6d5bd0", "#dc7a23", "#167b83"];
  const hash = [...value].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

function renderPartners(rows, query = "") {
  const normalizedQuery = query.trim().toLowerCase();
  const partners = rows.filter((row) => [row.partner, row.acronym, row.province, row.territory_source, row.theme, row.title].join(" ").toLowerCase().includes(normalizedQuery));
  const grid = document.getElementById("partner-grid");
  document.getElementById("partner-count").textContent = `${partners.length} partenaire(s)`;
  if (!partners.length) {
    grid.innerHTML = '<div class="empty-state">Aucun partenaire ne correspond à la sélection actuelle.</div>';
    return;
  }
  grid.innerHTML = partners.map((row) => `
    <article class="partner-card">
      <div class="partner-card-head"><span class="partner-badge" style="background:${badgeColor(row.acronym || row.partner)}">${escapeHtml(row.acronym || row.partner.slice(0, 3))}</span><span class="partner-status ${row.status === "En négociation" ? "negotiation" : ""}">${escapeHtml(row.status)}</span></div>
      <p class="partner-acronym">${escapeHtml(row.acronym)}</p>
      <h3>${escapeHtml(row.partner)}</h3>
      <div class="partner-meta"><span>${escapeHtml(row.province)}</span><span>${escapeHtml(row.theme)}</span><span>${escapeHtml(row.outcome)}</span></div>
      <div class="partner-budget"><div><small>Budget du projet</small><strong>${compactMoney(row.budget)}</strong></div><button class="partner-detail" type="button" data-project-id="${escapeHtml(row.id)}">Voir la fiche →</button></div>
    </article>
  `).join("");
  grid.querySelectorAll(".partner-detail").forEach((button) => button.addEventListener("click", () => openPartner(button.dataset.projectId)));
}

function openPartner(projectId) {
  const row = state.data.portfolio.find((item) => item.id === projectId);
  if (!row) return;
  const modal = document.getElementById("partner-modal");
  document.getElementById("modal-content").innerHTML = `
    <div class="modal-hero"><span class="partner-badge" style="background:${badgeColor(row.acronym || row.partner)}">${escapeHtml(row.acronym || row.partner.slice(0, 3))}</span><h2 id="modal-title">${escapeHtml(row.partner)}</h2><p>${escapeHtml(row.title)}</p></div>
    <div class="modal-body">
      <div class="modal-facts"><div><span>Province</span><strong>${escapeHtml(row.province)}</strong></div><div><span>Budget</span><strong>${compactMoney(row.budget)}</strong></div><div><span>Contribution Ebola</span><strong>${compactMoney(row.ebola)}</strong></div></div>
      <h3>Thématique</h3><p>${escapeHtml(row.theme)}</p>
      <h3>Localisation</h3><p>${escapeHtml(row.territory_source)}</p>
      <h3>Résumé du projet</h3><p>${escapeHtml(row.summary)}</p>
    </div>`;
  modal.showModal();
}

function updateAll() {
  const rows = filteredRows();
  updateKpis(rows);
  updateMap(rows);
  updateCharts(rows);
  renderPartners(rows, document.getElementById("partner-search").value);
}

function initializeMap() {
  state.map = L.map("map", { zoomControl: false, scrollWheelZoom: false, attributionControl: true });
  L.control.zoom({ position: "bottomright" }).addTo(state.map);
  state.map.attributionControl.setPrefix(false);
  state.map.attributionControl.addAttribution('<a href="https://www.geoboundaries.org/">geoBoundaries</a>');
  document.querySelectorAll("[data-map-metric]").forEach((button) => {
    button.addEventListener("click", () => {
      state.mapMetric = button.dataset.mapMetric;
      document.querySelectorAll("[data-map-metric]").forEach((item) => item.classList.toggle("active", item === button));
      updateMap(filteredRows());
    });
  });
}

function initializeNavigation() {
  const header = document.querySelector(".site-header");
  const toggle = document.querySelector(".menu-toggle");
  const mobile = document.querySelector(".mobile-nav");
  const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 36);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  toggle.addEventListener("click", () => {
    const open = mobile.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  mobile.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => { mobile.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); }));
}

function initializeReveal() {
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) { entry.target.classList.add("visible"); observer.unobserve(entry.target); }
  }), { threshold: .08 });
  document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
}

async function boot() {
  try {
    const [dataResponse, geoResponse] = await Promise.all([fetch(DATA_URL), fetch(GEO_URL)]);
    if (!dataResponse.ok || !geoResponse.ok) throw new Error("Impossible de charger les fichiers de données.");
    [state.data, state.geojson] = await Promise.all([dataResponse.json(), geoResponse.json()]);
    initializeNavigation();
    initializeReveal();
    initializeFilters();
    initializeMap();
    updateHero();
    updateAll();
    document.getElementById("partner-search").addEventListener("input", (event) => renderPartners(filteredRows(), event.target.value));
    document.querySelector(".modal-close").addEventListener("click", () => document.getElementById("partner-modal").close());
    document.getElementById("partner-modal").addEventListener("click", (event) => { if (event.target.id === "partner-modal") event.target.close(); });
  } catch (error) {
    console.error(error);
    document.getElementById("dashboard").innerHTML = `<div class="container"><div class="empty-state"><strong>La plateforme n’a pas pu charger les données.</strong><br />${escapeHtml(error.message)}</div></div>`;
  }
}

boot();
