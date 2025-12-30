const OVERRIDES_SOURCE = "./overrides.json";
const DEBUG_OVERRIDES = false;

const DATA_SOURCES = [
  "kaohsiung_parking_lots_2025-12-25_schema_placephoto_fallback.json",
  "kaohsiung_parking_lots_2025-12-25_curated.json",
];

const state = {
  rawItems: [],
  items: [],
};

const elements = {
  searchInput: document.getElementById("searchInput"),
  vehicleType: document.getElementById("vehicleType"),
  diffPricing: document.getElementById("diffPricing"),
  hasMonthlyCap: document.getElementById("hasMonthlyCap"),
  sortBy: document.getElementById("sortBy"),
  resultCount: document.getElementById("resultCount"),
  status: document.getElementById("status"),
  districtContainer: document.getElementById("districtContainer"),
};

function loadData() {
  return fetch(DATA_SOURCES[0])
    .then((response) => {
      if (!response.ok) {
        throw new Error("Primary data load failed");
      }
      return response.json();
    })
    .catch(() => {
      return fetch(DATA_SOURCES[1]).then((response) => {
        if (!response.ok) {
          throw new Error("Fallback data load failed");
        }
        return response.json();
      });
    });
}

function loadOverrides() {
  return fetch(OVERRIDES_SOURCE)
    .then((res) => {
      if (!res.ok) return {};
      return res.json();
    })
    .catch(() => ({}));
}

function normalizeOverrideKey(name) {
  return String(name || "")
    .replace(/\s+/g, "")
    .replace(/停車場/g, "")
    .trim();
}

function buildOverrideMaps(overrides) {
  const exact = new Map();
  const relaxed = new Map();
  const keys = [];

  Object.entries(overrides || {}).forEach(([key, value]) => {
    const trimmed = String(key || "").trim();
    if (!trimmed) {
      return;
    }
    exact.set(trimmed, value);
    keys.push(trimmed);

    const relaxedKey = normalizeOverrideKey(trimmed);
    if (relaxedKey && !relaxed.has(relaxedKey)) {
      relaxed.set(relaxedKey, value);
    }
  });

  return { exact, relaxed, keys };
}

function normalizeItem(raw) {
  const isSchema = Boolean(raw.pricing || raw.thumbnail || raw.google);
  if (isSchema) {
    return {
      name: raw.parking_name || "未命名停車場",
      address: raw.address || "",
      vehicleTypes: raw.vehicle_types || "",
      pricingWeekday: raw.pricing?.weekday || "",
      pricingWeekend: raw.pricing?.weekend || "",
      googleRating: raw.google?.rating || "",
      googleReviewCount: raw.google?.review_count || "",
      mapsUrl: raw.google?.maps_url || "",
      thumbnail: raw.thumbnail || {},
    };
  }

  return {
    name: raw.parking_name || raw.name || "未命名停車場",
    address: raw.address || "",
    vehicleTypes: raw.vehicle_types || raw.vehicle_type || "",
    pricingWeekday: raw.weekday_fee || raw.pricing_weekday || "",
    pricingWeekend: raw.weekend_fee || raw.pricing_weekend || "",
    googleRating: raw.google_rating || "",
    googleReviewCount: raw.google_review_count || "",
    mapsUrl: raw.google_maps_url || "",
    thumbnail: {
      street_view: {
        url: raw.street_view_thumbnail_url || "",
      },
    },
  };
}

function getThumbnailUrl(item) {
  const thumbnail = item.thumbnail || {};
  const placePhoto = thumbnail.place_photo || {};
  const templates = placePhoto.templates || {};

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

  if (thumbnail.street_view?.url) {
    return thumbnail.street_view.url;
  }

  return "";
}

function normalizeVehicleTypes(value) {
  if (!value) {
    return [];
  }
  return value
    .split(/[、/+,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getDistrict(address) {
  if (!address) {
    return "其他";
  }
  const match = address.match(/高雄市([^\d]{1,4}區)/);
  return match ? match[1] : "其他";
}

function parseFirstNumber(text) {
  if (!text) {
    return Number.POSITIVE_INFINITY;
  }
  const match = String(text).match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function hasMonthlyOrCap(text) {
  if (!text) {
    return false;
  }
  return /(月租|上限|最高)/.test(text);
}

function applyFilters() {
  const query = elements.searchInput.value.trim();
  const vehicleType = elements.vehicleType.value;
  const needsDiff = elements.diffPricing.checked;
  const needsMonthlyCap = elements.hasMonthlyCap.checked;
  const sortBy = elements.sortBy.value;

  let filtered = state.items.filter((item) => {
    const matchesQuery =
      !query ||
      item.name.includes(query) ||
      item.address.includes(query);

    const types = normalizeVehicleTypes(item.vehicleTypes);
    let matchesVehicle = true;
    if (vehicleType === "汽車+機車") {
      matchesVehicle = types.includes("汽車") && types.includes("機車");
    } else if (vehicleType !== "all") {
      matchesVehicle = types.includes(vehicleType);
    }

    const diffPricing =
      !needsDiff ||
      (item.pricingWeekday &&
        item.pricingWeekend &&
        item.pricingWeekday !== item.pricingWeekend);

    const monthlyCap =
      !needsMonthlyCap ||
      hasMonthlyOrCap(item.pricingWeekday) ||
      hasMonthlyOrCap(item.pricingWeekend);

    return matchesQuery && matchesVehicle && diffPricing && monthlyCap;
  });

  if (sortBy === "name") {
    filtered.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
  } else {
    filtered.sort(
      (a, b) => parseFirstNumber(a.pricingWeekday) - parseFirstNumber(b.pricingWeekday)
    );
  }

  renderList(filtered);
}

function renderList(items) {
  elements.districtContainer.innerHTML = "";
  elements.status.style.display = items.length ? "none" : "block";
  elements.status.textContent = items.length ? "" : "沒有符合條件的停車場";

  const grouped = new Map();
  items.forEach((item) => {
    const district = getDistrict(item.address);
    if (!grouped.has(district)) {
      grouped.set(district, []);
    }
    grouped.get(district).push(item);
  });

  [...grouped.keys()]
    .sort((a, b) => a.localeCompare(b, "zh-Hant"))
    .forEach((district) => {
      const section = document.createElement("section");
      section.className = "district-section";

      const title = document.createElement("h2");
      title.className = "district-title";
      title.textContent = district;

      const cards = document.createElement("div");
      cards.className = "cards";

      grouped.get(district).forEach((item) => {
        const card = document.createElement("article");
        card.className = "card";

        const thumbUrl = getThumbnailUrl(item);
        if (thumbUrl) {
          const img = document.createElement("img");
          img.src = thumbUrl;
          img.alt = `${item.name} 縮圖`;
          card.appendChild(img);
        } else {
          const placeholder = document.createElement("div");
          placeholder.className = "placeholder";
          placeholder.textContent = "No Image";
          card.appendChild(placeholder);
        }

        const body = document.createElement("div");
        body.className = "card-body";

        const titleEl = document.createElement("h3");
        titleEl.className = "card-title";
        titleEl.textContent = item.name;

        const addressEl = document.createElement("p");
        addressEl.className = "card-meta";
        addressEl.textContent = item.address || "地址資料待補";

        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = item.vehicleTypes || "未標示";

        const pricing = document.createElement("div");
        pricing.className = "price";
        pricing.innerHTML = `平日：${item.pricingWeekday || "-"}<br />假日：${item.pricingWeekend || "-"}`;

        const googleInfo = document.createElement("p");
        googleInfo.className = "card-meta";
        if (item.googleRating) {
          googleInfo.textContent = `⭐ ${item.googleRating}（${item.googleReviewCount || 0}）`;
        } else {
          googleInfo.textContent = "尚未載入 Google 評分";
        }

        const actions = document.createElement("div");
        actions.className = "card-actions";

        const copyButton = document.createElement("button");
        copyButton.type = "button";
        copyButton.className = "copy-button";
        copyButton.textContent = "複製地址";
        copyButton.addEventListener("click", () => {
          const text = item.address || item.name;
          if (!text) {
            return;
          }
          navigator.clipboard
            .writeText(text)
            .then(() => {
              copyButton.textContent = "已複製";
              setTimeout(() => {
                copyButton.textContent = "複製地址";
              }, 1500);
            })
            .catch(() => {
              copyButton.textContent = "複製失敗";
              setTimeout(() => {
                copyButton.textContent = "複製地址";
              }, 1500);
            });
        });

        const mapButton = document.createElement("a");
        mapButton.className = "map-button";
        mapButton.textContent = "在 Google 地圖開啟";
        mapButton.target = "_blank";
        mapButton.rel = "noopener noreferrer";
        mapButton.href = item.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.name} ${item.address}`)}`;

        actions.append(copyButton, mapButton);

        body.append(titleEl, addressEl, badge, pricing, googleInfo, actions);
        card.appendChild(body);
        cards.appendChild(card);
      });

      section.append(title, cards);
      elements.districtContainer.appendChild(section);
    });

  elements.resultCount.textContent = `共 ${state.items.length} 筆，符合條件 ${items.length} 筆`;
}

function initialize() {
  Promise.all([loadData(), loadOverrides()])
  .then(([data, overrides]) => {
    const list = Array.isArray(data) ? data : data.items || data.data || [];
    state.rawItems = list;

    const overrideMap = overrides && typeof overrides === "object" ? overrides : {};
    const overrideMaps = buildOverrideMaps(overrideMap);
    const unmatchedNames = [];

    state.items = list.map((raw) => {
      const item = normalizeItem(raw);
      const key = (item.name || "").trim();
      let ov = overrideMaps.exact.get(key);
      if (!ov) {
        const relaxedKey = normalizeOverrideKey(key);
        ov = overrideMaps.relaxed.get(relaxedKey);
      }

      if (ov) {
        // 你 Python 產出的欄位是 google_rating / google_review_count
        item.googleRating = ov.google_rating ?? item.googleRating;
        item.googleReviewCount = ov.google_review_count ?? item.googleReviewCount;

        // 可選：存更新日期，之後想顯示可用
        item.googleAsOf = ov.as_of ?? "";
      } else if (item.name) {
        unmatchedNames.push(item.name);
      }
      return item;
    });

    if (DEBUG_OVERRIDES) {
      console.log("overrides keys (first 5):", overrideMaps.keys.slice(0, 5));
      console.log("first item name:", state.items[0]?.name);
      console.log("first item googleRating:", state.items[0]?.googleRating);
    }

    if (unmatchedNames.length) {
      console.log("未匹配清單", unmatchedNames);
    }

    elements.status.style.display = "none";
    applyFilters();
  })
  .catch(() => {
    elements.status.textContent = "資料載入失敗，請稍後再試。";
  });


  [
    elements.searchInput,
    elements.vehicleType,
    elements.diffPricing,
    elements.hasMonthlyCap,
    elements.sortBy,
  ].forEach((element) => {
    element.addEventListener("input", applyFilters);
    element.addEventListener("change", applyFilters);
  });
}

initialize();
