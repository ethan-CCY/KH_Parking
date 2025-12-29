const DATA_SOURCES = [
  "./kaohsiung_parking_lots_2025-12-25_schema_placephoto_fallback.json",
  "./kaohsiung_parking_lots_2025-12-25_curated.json",
];

const state = {
  allItems: [],
  filteredItems: [],
  keyword: "",
  vehicleType: "all",
  diffPricing: false,
  hasMonthlyCap: false,
  sortBy: "name",
};

const elements = {
  searchInput: document.getElementById("searchInput"),
  vehicleTypeSelect: document.getElementById("vehicleTypeSelect"),
  diffPricing: document.getElementById("diffPricing"),
  hasMonthlyCap: document.getElementById("hasMonthlyCap"),
  sortSelect: document.getElementById("sortSelect"),
  resultCount: document.getElementById("resultCount"),
  listContainer: document.getElementById("listContainer"),
  statusMessage: document.getElementById("statusMessage"),
};

async function loadData() {
  for (const source of DATA_SOURCES) {
    try {
      const response = await fetch(source);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${source}`);
      }
      const rawData = await response.json();
      const normalized = rawData.map((item, index) => normalizeItem(item, index));
      return normalized;
    } catch (error) {
      console.warn(error);
    }
  }
  throw new Error("無法載入資料，請稍後再試。\n");
}

function normalizeItem(item, index) {
  const parkingName = item.parking_name || item.name || item.parkingName || "未命名停車場";
  const address = item.address || item.location || item.address_text || "";
  const vehicleTypes = item.vehicle_types || item.vehicleType || item.vehicle || "";
  const pricing = item.pricing || {
    weekday: item.pricing_weekday || item.weekday || "",
    weekend: item.pricing_weekend || item.weekend || "",
  };

  const google = item.google || {
    maps_url: item.maps_url || item.google_maps_url || "",
    rating: item.rating || "",
    review_count: item.review_count || "",
  };

  const thumbnail = item.thumbnail || {
    place_photo: item.place_photo || {},
    street_view: item.street_view || {},
  };

  return {
    id: item.id || item.parking_id || index,
    parking_name: parkingName,
    address,
    district: extractDistrict(address),
    vehicle_types: vehicleTypes,
    pricing: {
      weekday: pricing.weekday || "",
      weekend: pricing.weekend || "",
    },
    google: {
      maps_url: google.maps_url || "",
      rating: google.rating || "",
      review_count: google.review_count || "",
    },
    thumbnail: {
      place_photo: thumbnail.place_photo || {},
      street_view: thumbnail.street_view || {},
      templates: thumbnail.place_photo?.templates || thumbnail.templates || {},
    },
  };
}

function extractDistrict(address) {
  if (!address) return "其他";
  const match = address.match(/高雄市([^\s]{1,4}區)/);
  if (match && match[1]) {
    return match[1];
  }
  return "其他";
}

function getThumbnailUrl(item) {
  const placePhoto = item.thumbnail.place_photo || {};
  const streetView = item.thumbnail.street_view || {};
  const templates = placePhoto.templates || item.thumbnail.templates || {};

  if (placePhoto.url) {
    return placePhoto.url;
  }

  if (placePhoto.photo_reference && templates.classic_photoreference_url_template) {
    return templates.classic_photoreference_url_template.replace(
      "PHOTO_REFERENCE",
      placePhoto.photo_reference
    );
  }

  if (placePhoto.photo_resource_name && templates.new_photo_resource_url_template) {
    return templates.new_photo_resource_url_template.replace(
      "PHOTO_RESOURCE_NAME",
      placePhoto.photo_resource_name
    );
  }

  if (streetView.url) {
    return streetView.url;
  }

  return "";
}

function applyFilters() {
  const keyword = state.keyword.trim().toLowerCase();
  let result = state.allItems.filter((item) => {
    const matchesKeyword =
      !keyword ||
      item.parking_name.toLowerCase().includes(keyword) ||
      item.address.toLowerCase().includes(keyword);

    const type = item.vehicle_types || "";
    const matchesVehicle = (() => {
      if (state.vehicleType === "all") return true;
      if (state.vehicleType === "car") return type.includes("汽車") && !type.includes("機車");
      if (state.vehicleType === "motor") return type.includes("機車") && !type.includes("汽車");
      if (state.vehicleType === "both") return type.includes("汽車") && type.includes("機車");
      return true;
    })();

    const weekday = item.pricing.weekday || "";
    const weekend = item.pricing.weekend || "";
    const hasDiff = weekday && weekend && weekday !== weekend;
    const hasMonthly = /月租|上限|最高/.test(`${weekday}${weekend}`);

    const matchesDiffPricing = !state.diffPricing || hasDiff;
    const matchesMonthly = !state.hasMonthlyCap || hasMonthly;

    return matchesKeyword && matchesVehicle && matchesDiffPricing && matchesMonthly;
  });

  result = sortItems(result, state.sortBy);
  state.filteredItems = result;
  renderList();
}

function sortItems(items, sortBy) {
  const sorted = [...items];
  if (sortBy === "weekdayPrice") {
    sorted.sort((a, b) => {
      const aValue = extractPriceValue(a.pricing.weekday);
      const bValue = extractPriceValue(b.pricing.weekday);
      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;
      return aValue - bValue;
    });
    return sorted;
  }

  sorted.sort((a, b) => a.parking_name.localeCompare(b.parking_name, "zh-Hant"));
  return sorted;
}

function extractPriceValue(text) {
  if (!text) return null;
  const match = text.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  return Number(match[1]);
}

function renderList() {
  elements.listContainer.innerHTML = "";

  const total = state.allItems.length;
  const filtered = state.filteredItems.length;
  elements.resultCount.textContent = `共 ${total} 筆，符合條件 ${filtered} 筆`;

  if (filtered === 0) {
    elements.statusMessage.textContent = "沒有符合條件的停車場。";
    elements.statusMessage.style.display = "block";
    return;
  }

  elements.statusMessage.style.display = "none";

  const grouped = state.filteredItems.reduce((acc, item) => {
    const district = item.district || "其他";
    if (!acc[district]) acc[district] = [];
    acc[district].push(item);
    return acc;
  }, {});

  Object.keys(grouped)
    .sort((a, b) => a.localeCompare(b, "zh-Hant"))
    .forEach((district) => {
      const section = document.createElement("section");
      section.className = "district-group";

      const title = document.createElement("h2");
      title.className = "district-title";
      title.textContent = district;

      const cards = document.createElement("div");
      cards.className = "cards";

      grouped[district].forEach((item) => {
        cards.appendChild(renderCard(item));
      });

      section.appendChild(title);
      section.appendChild(cards);
      elements.listContainer.appendChild(section);
    });
}

function renderCard(item) {
  const card = document.createElement("article");
  card.className = "card";

  const imageWrapper = document.createElement("div");
  imageWrapper.className = "card-image";

  const thumbnailUrl = getThumbnailUrl(item);
  if (thumbnailUrl) {
    const img = document.createElement("img");
    img.src = thumbnailUrl;
    img.alt = `${item.parking_name} 縮圖`;
    img.loading = "lazy";
    imageWrapper.appendChild(img);
  } else {
    imageWrapper.textContent = "No Image";
  }

  const body = document.createElement("div");
  body.className = "card-body";

  const title = document.createElement("h3");
  title.className = "card-title";
  title.textContent = item.parking_name;

  const address = document.createElement("p");
  address.className = "meta";
  address.textContent = item.address;

  const vehicle = document.createElement("div");
  vehicle.className = "tag";
  vehicle.textContent = `停車種類：${item.vehicle_types || "未提供"}`;

  const pricing = document.createElement("p");
  pricing.className = "meta";
  pricing.innerHTML = `平日：${item.pricing.weekday || "未提供"}<br />假日：${
    item.pricing.weekend || "未提供"
  }`;

  const google = document.createElement("p");
  google.className = "meta";
  const ratingText = item.google.rating
    ? `⭐ ${item.google.rating}（${item.google.review_count || "-"}）`
    : "尚未載入 Google 評分";
  google.textContent = ratingText;

  const actions = document.createElement("div");
  actions.className = "actions";

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "button secondary";
  copyButton.textContent = "複製地址";
  copyButton.addEventListener("click", () => {
    navigator.clipboard
      .writeText(item.address)
      .then(() => {
        copyButton.textContent = "已複製";
        setTimeout(() => {
          copyButton.textContent = "複製地址";
        }, 1500);
      })
      .catch(() => {
        alert("複製失敗，請手動選取地址。");
      });
  });

  const mapLink = document.createElement("a");
  mapLink.className = "button primary";
  mapLink.textContent = "在 Google 地圖開啟";
  mapLink.href = item.google.maps_url || "#";
  mapLink.target = "_blank";
  mapLink.rel = "noopener noreferrer";

  actions.appendChild(copyButton);
  actions.appendChild(mapLink);

  body.appendChild(title);
  body.appendChild(address);
  body.appendChild(vehicle);
  body.appendChild(pricing);
  body.appendChild(google);
  body.appendChild(actions);

  card.appendChild(imageWrapper);
  card.appendChild(body);

  return card;
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.keyword = event.target.value;
    applyFilters();
  });

  elements.vehicleTypeSelect.addEventListener("change", (event) => {
    state.vehicleType = event.target.value;
    applyFilters();
  });

  elements.diffPricing.addEventListener("change", (event) => {
    state.diffPricing = event.target.checked;
    applyFilters();
  });

  elements.hasMonthlyCap.addEventListener("change", (event) => {
    state.hasMonthlyCap = event.target.checked;
    applyFilters();
  });

  elements.sortSelect.addEventListener("change", (event) => {
    state.sortBy = event.target.value;
    applyFilters();
  });
}

async function init() {
  try {
    state.allItems = await loadData();
    state.filteredItems = [...state.allItems];
    elements.statusMessage.style.display = "none";
    applyFilters();
  } catch (error) {
    elements.statusMessage.textContent = error.message || "資料載入失敗";
  }
}

bindEvents();
init();
