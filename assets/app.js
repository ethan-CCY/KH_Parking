const DATA_PRIMARY = "kaohsiung_parking_lots_2025-12-25_schema_placephoto_fallback.json";
const DATA_FALLBACK = "kaohsiung_parking_lots_2025-12-25_curated.json";

const state = {
  rawItems: [],
  filteredItems: [],
  totalCount: 0,
  dataSource: "",
};

const dom = {
  listContainer: document.getElementById("listContainer"),
  resultCount: document.getElementById("resultCount"),
  searchInput: document.getElementById("searchInput"),
  vehicleFilter: document.getElementById("vehicleFilter"),
  diffPricing: document.getElementById("diffPricing"),
  hasCap: document.getElementById("hasCap"),
  sortFilter: document.getElementById("sortFilter"),
  loadStatus: document.getElementById("loadStatus"),
};

function updateStatus(message, type = "") {
  dom.loadStatus.textContent = message;
  dom.loadStatus.className = `load-status ${type}`.trim();
}

async function loadData() {
  updateStatus("載入資料中...", "loading");
  try {
    const response = await fetch(DATA_PRIMARY);
    if (!response.ok) {
      throw new Error(`Primary data load failed: ${response.status}`);
    }
    const data = await response.json();
    state.dataSource = DATA_PRIMARY;
    return data;
  } catch (error) {
    console.warn(error);
    updateStatus("主要資料讀取失敗，改用備援資料。", "warning");
    const response = await fetch(DATA_FALLBACK);
    if (!response.ok) {
      throw new Error(`Fallback data load failed: ${response.status}`);
    }
    state.dataSource = DATA_FALLBACK;
    return response.json();
  }
}

function normalizeItem(item) {
  const pricing = item.pricing || {};
  const google = item.google || {};
  const thumbnail = item.thumbnail || {};
  const placePhoto = thumbnail.place_photo || {};
  const streetView = thumbnail.street_view || {};
  const placePhotoTemplates = placePhoto.templates || thumbnail.templates || item.templates || {};

  const address = item.address || item.address_text || "";
  const districtMatch = address.match(/.{2}區/);
  const district = item.district || (districtMatch ? districtMatch[0] : "其他");

  const vehicleText = item.vehicle_types || item.vehicleType || "";
  const hasCar = /汽車/.test(vehicleText);
  const hasMoto = /機車/.test(vehicleText);

  return {
    id: item.id || `${item.parking_name || ""}-${address}`,
    parkingName: item.parking_name || item.name || "未命名停車場",
    address,
    district,
    vehicleText,
    hasCar,
    hasMoto,
    pricingWeekday: pricing.weekday || pricing.weekday_fee || "",
    pricingWeekend: pricing.weekend || pricing.weekend_fee || "",
    googleRating: google.rating,
    googleReviewCount: google.review_count,
    googleMapsUrl: google.maps_url || google.url || "",
    thumbnail: {
      url: placePhoto.url || "",
      photoReference: placePhoto.photo_reference || "",
      photoResourceName: placePhoto.photo_resource_name || "",
      classicTemplate: placePhotoTemplates.classic_photoreference_url_template || "",
      newTemplate: placePhotoTemplates.new_photo_resource_url_template || "",
      streetViewUrl: streetView.url || "",
    },
  };
}

function getThumbnailUrl(thumbnail) {
  if (thumbnail.url) {
    return thumbnail.url;
  }
  if (thumbnail.photoReference && thumbnail.classicTemplate) {
    return thumbnail.classicTemplate.replace("PHOTO_REFERENCE", thumbnail.photoReference);
  }
  if (thumbnail.photoResourceName && thumbnail.newTemplate) {
    return thumbnail.newTemplate.replace("PHOTO_RESOURCE_NAME", thumbnail.photoResourceName);
  }
  if (thumbnail.streetViewUrl) {
    return thumbnail.streetViewUrl;
  }
  return "";
}

function applyFilters() {
  const keyword = dom.searchInput.value.trim();
  const keywordLower = keyword.toLowerCase();
  const vehicle = dom.vehicleFilter.value;
  const diffPricing = dom.diffPricing.checked;
  const hasCap = dom.hasCap.checked;
  const sort = dom.sortFilter.value;

  let filtered = state.rawItems.filter((item) => {
    const haystack = `${item.parkingName} ${item.address}`.toLowerCase();
    const keywordMatch = keywordLower ? haystack.includes(keywordLower) : true;

    let vehicleMatch = true;
    if (vehicle === "car") {
      vehicleMatch = item.hasCar;
    } else if (vehicle === "moto") {
      vehicleMatch = item.hasMoto;
    } else if (vehicle === "both") {
      vehicleMatch = item.hasCar && item.hasMoto;
    }

    const diffMatch = diffPricing
      ? item.pricingWeekday && item.pricingWeekend && item.pricingWeekday !== item.pricingWeekend
      : true;

    const capMatch = hasCap
      ? /月租|上限|最高/.test(`${item.pricingWeekday}${item.pricingWeekend}`)
      : true;

    return keywordMatch && vehicleMatch && diffMatch && capMatch;
  });

  if (sort === "name") {
    filtered.sort((a, b) => a.parkingName.localeCompare(b.parkingName, "zh-Hant"));
  } else if (sort === "weekday") {
    filtered.sort((a, b) => getPriceNumber(a.pricingWeekday) - getPriceNumber(b.pricingWeekday));
  }

  state.filteredItems = filtered;
  renderList();
}

function getPriceNumber(priceText) {
  const match = priceText.match(/\d+(?:\.\d+)?/);
  if (!match) {
    return Number.POSITIVE_INFINITY;
  }
  return Number(match[0]);
}

function renderList() {
  dom.listContainer.innerHTML = "";
  dom.resultCount.textContent = `共 ${state.totalCount} 筆，符合條件 ${state.filteredItems.length} 筆`;

  if (state.filteredItems.length === 0) {
    dom.listContainer.innerHTML = `<div class="empty-state">沒有符合條件的停車場資料。</div>`;
    return;
  }

  const grouped = state.filteredItems.reduce((acc, item) => {
    const key = item.district || "其他";
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {});

  const sortedDistricts = Object.keys(grouped).sort((a, b) => a.localeCompare(b, "zh-Hant"));

  sortedDistricts.forEach((district) => {
    const section = document.createElement("section");
    section.className = "district-section";

    const title = document.createElement("h3");
    title.className = "district-title";
    title.textContent = district;

    const grid = document.createElement("div");
    grid.className = "card-grid";

    grouped[district].forEach((item) => {
      grid.appendChild(renderCard(item));
    });

    section.appendChild(title);
    section.appendChild(grid);
    dom.listContainer.appendChild(section);
  });
}

function renderCard(item) {
  const card = document.createElement("article");
  card.className = "card";

  const imageWrap = document.createElement("div");
  imageWrap.className = "card-image";
  const imageUrl = getThumbnailUrl(item.thumbnail);
  if (imageUrl) {
    const img = document.createElement("img");
    img.src = imageUrl;
    img.alt = `${item.parkingName} 縮圖`;
    img.loading = "lazy";
    imageWrap.appendChild(img);
  } else {
    imageWrap.textContent = "No Image";
  }

  const body = document.createElement("div");
  body.className = "card-body";

  const title = document.createElement("h3");
  title.textContent = item.parkingName;

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.innerHTML = `
    <div><strong>地址：</strong>${item.address || "未提供"}</div>
    <div><strong>平日：</strong>${item.pricingWeekday || "未提供"}</div>
    <div><strong>假日：</strong>${item.pricingWeekend || "未提供"}</div>
    <div><strong>Google：</strong>${renderGoogleRating(item)}</div>
  `;

  const tags = document.createElement("div");
  tags.className = "tags";
  if (item.hasCar) {
    tags.appendChild(createTag("汽車"));
  }
  if (item.hasMoto) {
    tags.appendChild(createTag("機車"));
  }
  if (!item.hasCar && !item.hasMoto && item.vehicleText) {
    tags.appendChild(createTag(item.vehicleText));
  }

  const actions = document.createElement("div");
  actions.className = "card-actions";

  const copyButton = document.createElement("button");
  copyButton.className = "button";
  copyButton.textContent = "複製地址";
  copyButton.addEventListener("click", async () => {
    if (!item.address) return;
    try {
      await navigator.clipboard.writeText(item.address);
      copyButton.textContent = "已複製";
      setTimeout(() => {
        copyButton.textContent = "複製地址";
      }, 1200);
    } catch (error) {
      console.warn("Copy failed", error);
    }
  });

  const mapLink = document.createElement("a");
  mapLink.className = "button primary";
  mapLink.href = item.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.parkingName + " " + item.address)}`;
  mapLink.target = "_blank";
  mapLink.rel = "noopener noreferrer";
  mapLink.textContent = "在 Google 地圖開啟";

  actions.appendChild(copyButton);
  actions.appendChild(mapLink);

  body.appendChild(title);
  body.appendChild(tags);
  body.appendChild(meta);
  body.appendChild(actions);

  card.appendChild(imageWrap);
  card.appendChild(body);

  return card;
}

function renderGoogleRating(item) {
  if (item.googleRating) {
    const countText = item.googleReviewCount ? `（${item.googleReviewCount}）` : "";
    return `⭐ ${item.googleRating}${countText}`;
  }
  return "尚未載入 Google 評分";
}

function createTag(text) {
  const tag = document.createElement("span");
  tag.className = "tag";
  tag.textContent = text;
  return tag;
}

function bindEvents() {
  [dom.searchInput, dom.vehicleFilter, dom.sortFilter].forEach((el) => {
    el.addEventListener("input", applyFilters);
    el.addEventListener("change", applyFilters);
  });

  dom.diffPricing.addEventListener("change", applyFilters);
  dom.hasCap.addEventListener("change", applyFilters);
}

async function init() {
  try {
    const data = await loadData();
    const list = Array.isArray(data) ? data : data.items || [];
    state.rawItems = list.map(normalizeItem);
    state.totalCount = state.rawItems.length;
    updateStatus(`資料載入完成（${state.dataSource}）。`, "success");
    bindEvents();
    applyFilters();
  } catch (error) {
    console.error(error);
    updateStatus("資料載入失敗，請稍後再試。", "error");
    dom.listContainer.innerHTML = `<div class="empty-state">目前無法載入資料。</div>`;
  }
}

init();
