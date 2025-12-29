const DATA_PRIMARY = '/kaohsiung_parking_lots_2025-12-25_schema_placephoto_fallback.json';
const DATA_FALLBACK = '/kaohsiung_parking_lots_2025-12-25_curated.json';

const state = {
  items: [],
  filtered: [],
};

const elements = {
  searchInput: document.getElementById('searchInput'),
  vehicleSelect: document.getElementById('vehicleSelect'),
  diffPricing: document.getElementById('diffPricing'),
  hasCap: document.getElementById('hasCap'),
  sortSelect: document.getElementById('sortSelect'),
  listContainer: document.getElementById('listContainer'),
  resultCount: document.getElementById('resultCount'),
};

async function loadData() {
  const fetchJson = async (url) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}`);
    }
    return response.json();
  };

  try {
    const data = await fetchJson(DATA_PRIMARY);
    return { data, source: 'schema' };
  } catch (error) {
    console.warn('Primary data load failed, trying fallback.', error);
    const data = await fetchJson(DATA_FALLBACK);
    return { data, source: 'curated' };
  }
}

function normalizeItem(raw, source) {
  if (raw.pricing || raw.thumbnail || source === 'schema') {
    const vehicleTypes = parseVehicleTypes(raw.vehicle_types || '');
    return {
      name: raw.parking_name || '未命名停車場',
      address: raw.address || '未提供地址',
      vehicleTypes,
      pricing: {
        weekday: raw.pricing?.weekday || '',
        weekend: raw.pricing?.weekend || '',
      },
      google: {
        rating: raw.google?.rating || '',
        reviewCount: raw.google?.review_count || '',
        mapsUrl: raw.google?.maps_url || '',
      },
      thumbnail: {
        placePhoto: raw.thumbnail?.place_photo || {},
        streetViewUrl: raw.thumbnail?.street_view?.url || '',
      },
    };
  }

  const vehicleTypes = parseVehicleTypes(raw.vehicle_types || '');
  return {
    name: raw.parking_name || '未命名停車場',
    address: raw.address || '未提供地址',
    vehicleTypes,
    pricing: {
      weekday: raw.weekday_fee || '',
      weekend: raw.weekend_fee || '',
    },
    google: {
      rating: raw.google_rating || '',
      reviewCount: raw.google_review_count || '',
      mapsUrl: raw.google_maps_url || raw.google_maps || '',
    },
    thumbnail: {
      placePhoto: {},
      streetViewUrl: raw.street_view_thumbnail_url || '',
    },
  };
}

function getThumbnailUrl(item) {
  const placePhoto = item.thumbnail.placePhoto || {};
  if (placePhoto.url) {
    return placePhoto.url;
  }
  if (placePhoto.photo_reference && placePhoto.templates?.classic_photoreference_url_template) {
    return placePhoto.templates.classic_photoreference_url_template.replace(
      'PHOTO_REFERENCE',
      placePhoto.photo_reference,
    );
  }
  if (placePhoto.photo_resource_name && placePhoto.templates?.new_photo_resource_url_template) {
    return placePhoto.templates.new_photo_resource_url_template.replace(
      'PHOTO_RESOURCE_NAME',
      placePhoto.photo_resource_name,
    );
  }
  if (item.thumbnail.streetViewUrl) {
    return item.thumbnail.streetViewUrl;
  }
  return '';
}

function parseVehicleTypes(text) {
  const types = [];
  if (text.includes('汽車')) types.push('汽車');
  if (text.includes('機車')) types.push('機車');
  return types.length ? types : ['未標示'];
}

function getDistrict(address) {
  const match = address.match(/高雄市([^\d]+?區)/);
  return match ? match[1] : '其他';
}

function getFirstNumber(text) {
  const match = String(text || '').match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function applyFilters() {
  const keyword = elements.searchInput.value.trim().toLowerCase();
  const vehicle = elements.vehicleSelect.value;
  const diffPricing = elements.diffPricing.checked;
  const hasCap = elements.hasCap.checked;
  const sortBy = elements.sortSelect.value;

  let items = [...state.items];

  if (keyword) {
    items = items.filter((item) =>
      item.name.toLowerCase().includes(keyword) || item.address.toLowerCase().includes(keyword),
    );
  }

  if (vehicle !== 'all') {
    items = items.filter((item) => {
      const hasCar = item.vehicleTypes.includes('汽車');
      const hasMotorcycle = item.vehicleTypes.includes('機車');
      if (vehicle === 'car') return hasCar;
      if (vehicle === 'motorcycle') return hasMotorcycle;
      if (vehicle === 'both') return hasCar && hasMotorcycle;
      return true;
    });
  }

  if (diffPricing) {
    items = items.filter((item) => item.pricing.weekday !== item.pricing.weekend);
  }

  if (hasCap) {
    const regex = /(月租|上限|最高)/;
    items = items.filter((item) => regex.test(item.pricing.weekday) || regex.test(item.pricing.weekend));
  }

  if (sortBy === 'name') {
    items.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
  } else if (sortBy === 'weekday') {
    items.sort((a, b) => getFirstNumber(a.pricing.weekday) - getFirstNumber(b.pricing.weekday));
  }

  state.filtered = items;
  renderList();
}

function renderList() {
  const total = state.items.length;
  const filtered = state.filtered.length;
  elements.resultCount.textContent = `共 ${total} 筆，符合條件 ${filtered} 筆`;
  elements.listContainer.innerHTML = '';

  if (!filtered) {
    elements.listContainer.innerHTML = '<p>沒有符合條件的停車場。</p>';
    return;
  }

  const grouped = state.filtered.reduce((acc, item) => {
    const district = getDistrict(item.address);
    if (!acc[district]) acc[district] = [];
    acc[district].push(item);
    return acc;
  }, {});

  const districts = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'zh-Hant'));

  districts.forEach((district) => {
    const section = document.createElement('div');
    section.className = 'district-section';

    const title = document.createElement('h2');
    title.className = 'district-title';
    title.textContent = `${district}（${grouped[district].length}）`;
    section.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'card-grid';

    grouped[district].forEach((item) => {
      const card = document.createElement('article');
      card.className = 'card';

      const thumbUrl = getThumbnailUrl(item);
      if (thumbUrl) {
        const img = document.createElement('img');
        img.src = thumbUrl;
        img.alt = `${item.name} 縮圖`;
        card.appendChild(img);
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'placeholder';
        placeholder.textContent = 'No Image';
        card.appendChild(placeholder);
      }

      const content = document.createElement('div');
      content.className = 'card-content';

      const titleEl = document.createElement('h3');
      titleEl.textContent = item.name;
      content.appendChild(titleEl);

      const addressRow = document.createElement('div');
      addressRow.className = 'address-row';
      const addressEl = document.createElement('span');
      addressEl.className = 'meta';
      addressEl.textContent = item.address;
      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-btn';
      copyBtn.type = 'button';
      copyBtn.textContent = '複製';
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(item.address);
          copyBtn.textContent = '已複製';
          setTimeout(() => {
            copyBtn.textContent = '複製';
          }, 1200);
        } catch (error) {
          window.prompt('請手動複製地址', item.address);
        }
      });
      addressRow.append(addressEl, copyBtn);
      content.appendChild(addressRow);

      const types = document.createElement('div');
      item.vehicleTypes.forEach((type) => {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = type;
        types.appendChild(badge);
      });
      content.appendChild(types);

      const pricing = document.createElement('div');
      pricing.className = 'meta';
      pricing.textContent = `平日：${item.pricing.weekday || '未提供'} ｜ 假日：${item.pricing.weekend || '未提供'}`;
      content.appendChild(pricing);

      const googleInfo = document.createElement('div');
      googleInfo.className = 'meta';
      if (item.google.rating) {
        const reviewCount = item.google.reviewCount ? `（${item.google.reviewCount}）` : '';
        googleInfo.textContent = `⭐ ${item.google.rating}${reviewCount}`;
      } else {
        googleInfo.textContent = '尚未載入 Google 評分';
      }
      content.appendChild(googleInfo);

      card.appendChild(content);

      const footer = document.createElement('div');
      footer.className = 'card-footer';
      const link = document.createElement('a');
      link.href = item.google.mapsUrl || '#';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = '在 Google 地圖開啟';
      footer.appendChild(link);
      card.appendChild(footer);

      grid.appendChild(card);
    });

    section.appendChild(grid);
    elements.listContainer.appendChild(section);
  });
}

function bindEvents() {
  const handler = () => applyFilters();
  elements.searchInput.addEventListener('input', handler);
  elements.vehicleSelect.addEventListener('change', handler);
  elements.diffPricing.addEventListener('change', handler);
  elements.hasCap.addEventListener('change', handler);
  elements.sortSelect.addEventListener('change', handler);
}

async function init() {
  const { data, source } = await loadData();
  const normalized = Array.isArray(data) ? data.map((item) => normalizeItem(item, source)) : [];
  state.items = normalized;
  state.filtered = normalized;
  bindEvents();
  renderList();
}

init();
