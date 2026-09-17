const manualForm = document.querySelector("#manualForm");
const manualDatePicker = document.querySelector('[data-date-picker="manual"]');
const lookupResults = document.querySelector("#lookupResults");
const doubanBookmarklet = document.querySelector("#doubanBookmarklet");
const itemsEl = document.querySelector("#items");
const tableWrap = document.querySelector("#tableWrap");
const sortButtons = document.querySelectorAll(".summary-table th button[data-sort]");
const summaryBody = document.querySelector("#summaryBody");
const calendarView = document.querySelector("#calendarView");
const calendarGrid = document.querySelector("#calendarGrid");
const calendarTitle = document.querySelector("#calendarTitle");
const calendarSelection = document.querySelector("#calendarSelection");
const prevMonthBtn = document.querySelector("#prevMonthBtn");
const nextMonthBtn = document.querySelector("#nextMonthBtn");
const detailView = document.querySelector("#detailView");
const detailForm = document.querySelector("#detailForm");
const detailDatePicker = document.querySelector('[data-date-picker="detail"]');
const detailPosterPreview = document.querySelector("#detailPosterPreview");
const backToTableBtn = document.querySelector("#backToTableBtn");
const backToCardsBtn = document.querySelector("#backToCardsBtn");
const backToCalendarBtn = document.querySelector("#backToCalendarBtn");
const deleteDetailBtn = document.querySelector("#deleteDetailBtn");
const statsEl = document.querySelector("#stats");
const searchInput = document.querySelector("#searchInput");
const filterButtons = document.querySelectorAll(".filters button");
const viewButtons = document.querySelectorAll(".view-tabs button");
const exportBtn = document.querySelector("#exportBtn");
const importInput = document.querySelector("#importInput");
const itemTemplate = document.querySelector("#itemTemplate");
const resultTemplate = document.querySelector("#resultTemplate");
const modeBanner = document.querySelector("#modeBanner");
const appContent = document.querySelector("#appContent");
const cloudStatus = document.querySelector("#cloudStatus");
const cloudHint = document.querySelector("#cloudHint");
const loginForm = document.querySelector("#loginForm");
const emailInput = document.querySelector("#emailInput");
const passwordInput = document.querySelector("#passwordInput");
const loginBtn = document.querySelector("#loginBtn");
const syncBtn = document.querySelector("#syncBtn");
const logoutBtn = document.querySelector("#logoutBtn");
const headerActions = document.querySelector(".header-actions");
const appHeader = document.querySelector(".app-header");
const layout = document.querySelector(".layout");
const capturePanel = document.querySelector("#capturePanel");
const isFileMode = window.location.protocol === "file:";
const localKey = "media-library-preview";
const config = window.MEDIA_LIBRARY_CONFIG || {};
const tableName = config.TABLE_NAME || "media_library_items";
const hasSupabaseConfig = Boolean(config.SUPABASE_URL && config.SUPABASE_ANON_KEY);
const supabaseClient =
  hasSupabaseConfig && window.supabase
    ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY)
    : null;

const typeLabels = {
  book: "书籍",
  movie: "电影",
  series: "电视剧",
  variety: "综艺",
  anime: "动画",
  podcast: "播客",
  game: "游戏",
  music: "音乐"
};

const statusLabels = {
  done: "已完成",
  watching: "进行中",
  planned: "想读/待读"
};

let library = { items: [] };
let currentFilter = "all";
let currentStatusFilter = "all";
let currentView = "table";
let previousView = "table";
let selectedItemId = "";
let lastResults = [];
let calendarCursor = new Date();
let selectedCalendarDate = "";
let sortState = { key: "date", direction: "desc" };
let currentUser = null;
let isCloudReady = false;
let cloudLoadPromise = null;
const datePickerStates = new Map();
const posterUrlCache = new Map();
const appBaseUrl = new URL(".", window.location.href).href;

const bookmarkletCode = `(() => {
  const q = (selector) => document.querySelector(selector);
  const qa = (selector) => Array.from(document.querySelectorAll(selector));
  const text = (node) => node ? node.textContent.replace(/\\s+/g, " ").trim() : "";
  const meta = (name) => {
    const node = q(\`meta[property="\${name}"],meta[name="\${name}"]\`);
    return node ? node.content.trim() : "";
  };
  const host = location.hostname;
  const isDoubanHost = host === "douban.com" || host.endsWith(".douban.com");
  if (!isDoubanHost || !/^\\/subject\\/\\d+\\/?/.test(location.pathname)) {
    alert("采集无效：请先在当前标签页打开豆瓣的具体条目页，再点击这个书签。");
    return;
  }
  const type = host.includes("book.douban.com") ? "book" : host.includes("music.douban.com") ? "music" : "movie";
  const localDateKey = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return \`\${year}-\${month}-\${day}\`;
  };
  const pageText = document.body ? document.body.innerText : "";
  const title = text(q('[property="v:itemreviewed"]')) || text(q("h1")) || meta("og:title") || document.title.replace(/\\s*\\(豆瓣\\).*$/, "");
  const year = (text(q(".year")).match(/\\d{4}/) || [])[0] || ((meta("og:title") + " " + pageText).match(/\\d{4}/) || [])[0] || "";
  const director = qa('[rel="v:directedBy"]').map(text).filter(Boolean).join(" / ");
  const cast = qa('[rel="v:starring"]').map(text).filter(Boolean).slice(0, 10);
  const genres = qa('[property="v:genre"]').map(text).filter(Boolean);
  const normalizeUrl = (value) => {
    if (!value) return "";
    try {
      return new URL(value, location.href).href;
    } catch {
      return value;
    }
  };
  const isImageLike = (value) => /doubanio\\.com|\\.(jpe?g|png|webp|avif)(\\?|#|$)|\\/view\\/photo\\//i.test(value || "");
  const imageUrl = (node) => {
    if (!node) return "";
    const srcset = node.getAttribute("srcset") || node.getAttribute("data-srcset") || "";
    const fromSet = srcset.split(",").map((part) => part.trim().split(/\\s+/)[0]).filter(Boolean).pop();
    const choices = [
      node.currentSrc,
      node.src,
      node.dataset.original,
      node.dataset.src,
      node.dataset.normal,
      node.dataset.pic,
      node.dataset.lazy,
      node.dataset.lazySrc,
      node.getAttribute("data-original"),
      node.getAttribute("data-src"),
      node.getAttribute("data-normal"),
      node.getAttribute("data-pic"),
      node.getAttribute("data-lazy"),
      node.getAttribute("data-lazy-src"),
      fromSet,
      node.getAttribute("src"),
      node.dataset.url,
      node.getAttribute("data-url")
    ].map(normalizeUrl);
    return choices.find(isImageLike) || "";
  };
  const scoreImage = (node) => {
    const src = imageUrl(node);
    const box = node.getBoundingClientRect ? node.getBoundingClientRect() : { width: 0, height: 0 };
    const alt = node.alt || "";
    const around = [node.id, node.className, node.parentElement?.id, node.parentElement?.className].join(" ");
    let score = 0;
    if (/doubanio\\.com|douban\\.com/.test(src)) score += 20;
    if (/s_ratio_poster|photo|poster|view\\/photo|public\\//.test(src)) score += 28;
    if (/mainpic|nbg|poster|subject|pic/.test(String(around))) score += 24;
    if (/海报|封面|poster/i.test(alt)) score += 18;
    if ((node.naturalHeight || box.height) > (node.naturalWidth || box.width)) score += 10;
    score += Math.min(18, Math.round(((node.naturalWidth || box.width || 0) * (node.naturalHeight || box.height || 0)) / 12000));
    if (/avatar|icon|logo|rating|app|qrcode|bn|blank/.test(src + " " + around)) score -= 30;
    return score;
  };
  const posterCandidates = qa("img")
    .map((node) => ({ node, src: imageUrl(node), score: scoreImage(node) }))
    .filter((item) => item.src && item.score > 0)
    .sort((a, b) => b.score - a.score);
  const poster = imageUrl(q("#mainpic img")) || imageUrl(q(".nbg img")) || imageUrl(q('[rel="v:image"]')) || posterCandidates[0]?.src || normalizeUrl(meta("og:image"));
  const description = text(q('[property="v:summary"]')) || meta("og:description") || meta("description");
  const authorMatches = type === "book" ? Array.from(pageText.matchAll(/作者\\s*:?\\s*([^\\n]+)/g)).map((match) => match[1].trim()).slice(0, 1) : [];
  const subjectId = (location.href.match(/subject\\/(\\d+)/) || [])[1] || location.href;
  const item = {
    sourceId: \`douban-browser:\${subjectId}\`,
    source: "豆瓣浏览器采集",
    sourceUrl: location.href,
    type,
    title: title || "豆瓣条目",
    subtitle: "",
    creator: type === "book" ? authorMatches.join(" / ") : cast.slice(0, 3).join(" / "),
    director,
    cast,
    publisher: "",
    platform: "",
    year,
    genres,
    poster,
    description,
    status: "done",
    date: localDateKey(),
    rating: 0
  };
  if (!item.title || item.title === "豆瓣") {
    alert("没有识别到豆瓣条目内容，请确认当前是具体 subject 条目页。");
    return;
  }
  if (!item.poster) {
    alert("已识别到条目，但没有取到海报。请确认页面海报已经加载出来后再点书签。");
  }
  const data = btoa(unescape(encodeURIComponent(JSON.stringify(item))));
  location.href = "${appBaseUrl}?capture=" + encodeURIComponent(data);
})()`;

function updateCaptureLayout() {
  layout.classList.toggle("capture-collapsed", !capturePanel.open);
}

async function api(path, options = {}) {
  if (supabaseClient) return cloudApi(path, options);
  return localApi(path, options);
}

function sortLibrary(items) {
  return {
    items: [...items].sort((a, b) => {
      const left = new Date(b.updatedAt || b.createdAt || 0).getTime();
      const right = new Date(a.updatedAt || a.createdAt || 0).getTime();
      return left - right;
    })
  };
}

function makeClientItem(payload, existing = null) {
  const now = new Date().toISOString();
  const next = {
    ...(existing || {}),
    ...payload,
    id: existing?.id || payload.id || crypto.randomUUID(),
    status: payload.status || existing?.status || "done",
    rating: Number(payload.rating ?? existing?.rating ?? 0),
    createdAt: existing?.createdAt || payload.createdAt || now,
    updatedAt: now
  };
  if (next.poster && !next.image) next.image = next.poster;
  if (next.image && !next.poster) next.poster = next.image;
  return next;
}

async function readCloudLibrary() {
  if (!isCloudReady) return { items: [] };
  const { data, error } = await supabaseClient
    .from(tableName)
    .select("id,item,created_at,updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(formatCloudError(error));
  return sortLibrary(
    (data || []).map((row) => ({
      ...(row.item || {}),
      id: row.id,
      createdAt: row.item?.createdAt || row.created_at,
      updatedAt: row.item?.updatedAt || row.updated_at
    }))
  );
}

async function cloudApi(path, options = {}) {
  if (!isCloudReady) throw new Error("请先使用邮箱和密码登录。");
  const method = options.method || "GET";

  if (path === "/api/library" && method === "GET") {
    return readCloudLibrary();
  }

  if (path === "/api/items" && method === "POST") {
    const item = makeClientItem(JSON.parse(options.body || "{}"));
    const { error } = await supabaseClient.from(tableName).insert({
      id: item.id,
      item,
      created_by: currentUser.id,
      created_at: item.createdAt,
      updated_at: item.updatedAt
    });
    if (error) throw new Error(formatCloudError(error));
    return readCloudLibrary();
  }

  if (path.startsWith("/api/items/") && method === "PUT") {
    const id = decodeURIComponent(path.replace("/api/items/", ""));
    const existing = library.items.find((item) => item.id === id);
    if (!existing) throw new Error("没有找到这条记录。");
    const item = makeClientItem(JSON.parse(options.body || "{}"), existing);
    const { error } = await supabaseClient
      .from(tableName)
      .update({ item, updated_at: item.updatedAt })
      .eq("id", id);
    if (error) throw new Error(formatCloudError(error));
    return readCloudLibrary();
  }

  if (path.startsWith("/api/items/") && method === "DELETE") {
    const id = decodeURIComponent(path.replace("/api/items/", ""));
    const { error } = await supabaseClient.from(tableName).delete().eq("id", id);
    if (error) throw new Error(formatCloudError(error));
    return readCloudLibrary();
  }

  if (path === "/api/import" && method === "POST") {
    const payload = JSON.parse(options.body || "{}");
    if (!Array.isArray(payload.items)) throw new Error("导入文件格式不正确。");
    const { error: deleteError } = await supabaseClient.from(tableName).delete().neq("id", crypto.randomUUID());
    if (deleteError) throw new Error(formatCloudError(deleteError));
    if (payload.items.length) {
      const rows = payload.items.map((source) => {
        const item = makeClientItem(source, source);
        return {
          id: item.id,
          item,
          created_by: currentUser.id,
          created_at: item.createdAt,
          updated_at: item.updatedAt
        };
      });
      const { error: insertError } = await supabaseClient.from(tableName).insert(rows);
      if (insertError) throw new Error(formatCloudError(insertError));
    }
    return readCloudLibrary();
  }

  throw new Error("当前操作不受支持。");
}

function formatCloudError(error) {
  const message = String(error?.message || "");
  if (message.includes(tableName) && /schema cache|does not exist|relation/i.test(message)) {
    return `Supabase 中还没有 ${tableName} 表，请先运行仓库里的 supabase-schema.sql。`;
  }
  if (/row-level security|permission denied/i.test(message)) {
    return "数据库权限策略阻止了本次操作，请重新运行 supabase-schema.sql。";
  }
  return message || "云端请求失败，请稍后重试。";
}

function readLocalLibrary() {
  try {
    return JSON.parse(localStorage.getItem(localKey)) || { items: [] };
  } catch {
    return { items: [] };
  }
}

function writeLocalLibrary(nextLibrary) {
  const sorted = {
    items: [...nextLibrary.items].sort((a, b) => {
      const left = new Date(b.updatedAt || b.createdAt || 0).getTime();
      const right = new Date(a.updatedAt || a.createdAt || 0).getTime();
      return left - right;
    })
  };
  localStorage.setItem(localKey, JSON.stringify(sorted));
  return sorted;
}

async function localApi(path, options = {}) {
  if (path === "/api/library") {
    return readLocalLibrary();
  }

  if (path.startsWith("/api/search")) {
    throw new Error("直接打开文件时不能联网抓资料。请用 http://localhost:8787 打开正式版。");
  }

  if (path.startsWith("/api/douban")) {
    throw new Error("直接打开文件时不能读取豆瓣链接。请用 http://localhost:8787 打开正式版。");
  }

  if (path === "/api/items" && options.method === "POST") {
    const payload = JSON.parse(options.body || "{}");
    const now = new Date().toISOString();
    const item = {
      ...payload,
      id: crypto.randomUUID(),
      status: payload.status || "done",
      rating: Number(payload.rating || 0),
      createdAt: now,
      updatedAt: now
    };
    const nextLibrary = readLocalLibrary();
    nextLibrary.items.unshift(item);
    return writeLocalLibrary(nextLibrary);
  }

  if (path.startsWith("/api/items/") && options.method === "DELETE") {
    const id = decodeURIComponent(path.replace("/api/items/", ""));
    const nextLibrary = readLocalLibrary();
    nextLibrary.items = nextLibrary.items.filter((item) => item.id !== id);
    return writeLocalLibrary(nextLibrary);
  }

  if (path.startsWith("/api/items/") && options.method === "PUT") {
    const id = decodeURIComponent(path.replace("/api/items/", ""));
    const payload = JSON.parse(options.body || "{}");
    const nextLibrary = readLocalLibrary();
    const index = nextLibrary.items.findIndex((item) => item.id === id);
    if (index === -1) throw new Error("没有找到这条记录。");
    nextLibrary.items[index] = {
      ...nextLibrary.items[index],
      ...payload,
      updatedAt: new Date().toISOString()
    };
    return writeLocalLibrary(nextLibrary);
  }

  if (path === "/api/import" && options.method === "POST") {
    const payload = JSON.parse(options.body || "{}");
    if (!Array.isArray(payload.items)) {
      throw new Error("导入文件格式不正确。");
    }
    return writeLocalLibrary({ items: payload.items });
  }

  throw new Error("当前打开方式不支持这个操作。");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function compact(value, fallback = "未知") {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(" / ") || fallback;
  }
  return String(value || "").trim() || fallback;
}

function isDoubanImage(src) {
  try {
    const url = new URL(src, window.location.href);
    return url.hostname === "doubanio.com" || url.hostname.endsWith(".doubanio.com");
  } catch {
    return false;
  }
}

function displayImage(src) {
  if (!src) return "";
  try {
    const url = new URL(src, window.location.href);
    if (isDoubanImage(url.href)) {
      const fileName = url.pathname.split("/").filter(Boolean).pop();
      if (fileName && /\.(?:jpe?g|png|webp)$/i.test(fileName)) {
        return new URL(`./posters/${fileName}`, appBaseUrl).href;
      }
    }
    return url.href;
  } catch {
    return src;
  }
}

async function fetchProxiedPoster(src) {
  if (!supabaseClient || !isDoubanImage(src)) return new URL(src, window.location.href).href;
  if (!posterUrlCache.has(src)) {
    const pending = (async () => {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error || !data.session?.access_token) throw new Error("登录状态已失效，请重新登录。");

      const endpoint = new URL("/functions/v1/douban-image", config.SUPABASE_URL);
      endpoint.searchParams.set("url", src);
      const response = await fetch(endpoint.href, {
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
          apikey: config.SUPABASE_ANON_KEY
        }
      });
      if (!response.ok) throw new Error(`海报代理请求失败：${response.status}`);
      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) throw new Error("海报代理返回的不是图片。");
      return URL.createObjectURL(blob);
    })();
    posterUrlCache.set(src, pending);
    pending.catch(() => posterUrlCache.delete(src));
  }
  return posterUrlCache.get(src);
}

function setPosterImage(image, src, onError = null) {
  const source = String(src || "").trim();
  image.dataset.posterSource = source;
  image.hidden = true;
  if (!source) {
    if (onError) onError();
    return;
  }

  const applyUrl = (url, allowFallback) => {
    if (image.dataset.posterSource !== source) return;
    image.addEventListener("load", () => {
      if (image.dataset.posterSource === source) image.hidden = false;
    }, { once: true });
    image.addEventListener("error", () => {
      if (image.dataset.posterSource !== source) return;
      if (allowFallback && isDoubanImage(source)) {
        applyUrl(displayImage(source), false);
        return;
      }
      image.hidden = true;
      if (onError) onError();
    }, { once: true });
    image.src = url;
  };

  if (!isDoubanImage(source)) {
    applyUrl(displayImage(source), false);
    return;
  }

  fetchProxiedPoster(source)
    .then((url) => applyUrl(url, true))
    .catch(() => applyUrl(displayImage(source), false));
}

function clearPosterCache() {
  for (const pending of posterUrlCache.values()) {
    pending.then((url) => URL.revokeObjectURL(url)).catch(() => {});
  }
  posterUrlCache.clear();
}

function itemMeta(item) {
  return [
    item.year,
    item.publisher || item.platform,
    compact(item.genres, "")
  ]
    .filter(Boolean)
    .join(" · ");
}

function isScreenWork(item) {
  return ["movie", "series", "variety", "anime"].includes(item.type);
}

function primaryCreator(item) {
  if (isScreenWork(item)) return item.director || item.creator || "";
  return item.creator || item.director || "";
}

function itemStartDate(item) {
  if (item.status === "planned") return "";
  return item.startDate || item.date || item.endDate || "";
}

function itemEndDate(item) {
  if (item.status === "planned") return "";
  if (item.status === "watching") return itemStartDate(item) ? todayKey() : "";
  return item.endDate || item.date || item.startDate || "";
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayKey() {
  return dateKey(new Date());
}

function parseDateKey(value) {
  if (!value) return null;
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function parseFlexibleDate(value, fallback = {}) {
  const text = String(value || "").trim();
  if (!text) return null;
  let match = text.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  match = text.match(/(\d{1,2})[./月](\d{1,2})/);
  if (match) {
    return new Date(fallback.year || new Date().getFullYear(), Number(match[1]) - 1, Number(match[2]));
  }
  match = text.match(/^(\d{1,2})$/);
  if (match && fallback.month) {
    return new Date(fallback.year || new Date().getFullYear(), fallback.month - 1, Number(match[1]));
  }
  return null;
}

function expandDateRange(start, end) {
  if (!start && !end) return [];
  const first = start || end;
  const last = end || start;
  const from = first <= last ? first : last;
  const to = first <= last ? last : first;
  const days = [];
  const cursor = new Date(from);
  while (cursor <= to && days.length < 370) {
    days.push(dateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function normalizeSegment(segment) {
  const start = String(segment?.start || "").trim();
  const end = String(segment?.end || segment?.start || "").trim();
  if (!parseDateKey(start) && !parseDateKey(end)) return null;
  return {
    start: start || end,
    end: end || start
  };
}

function sortSegments(segments) {
  return segments
    .map(normalizeSegment)
    .filter(Boolean)
    .sort((left, right) => left.start.localeCompare(right.start) || left.end.localeCompare(right.end));
}

function parseTextSegments(value) {
  const fallbackYear = new Date().getFullYear();
  const segments = String(value || "")
    .split(/[\n,，、；;]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const parsed = [];

  for (const segment of segments) {
    const compactSegment = segment.replace(/\s+/g, "");
    let startText = compactSegment;
    let endText = "";

    const wordRange = compactSegment.split(/(?:~|至|到|—|–)/);
    if (wordRange.length >= 2) {
      [startText, endText] = wordRange;
    } else {
      const shortRange = compactSegment.match(/^(.+?)-(\d{1,2})$/);
      if (shortRange && !/^\d{4}-\d{1,2}-\d{1,2}$/.test(compactSegment)) {
        startText = shortRange[1];
        endText = shortRange[2];
      }
    }

    const start = parseFlexibleDate(startText, { year: fallbackYear });
    const end = endText
      ? parseFlexibleDate(endText, {
          year: start?.getFullYear() || fallbackYear,
          month: start ? start.getMonth() + 1 : undefined
        })
      : start;

    const expanded = expandDateRange(start, end);
    if (expanded.length) {
      parsed.push({ start: expanded[0], end: expanded[expanded.length - 1] });
    }
  }

  return sortSegments(parsed);
}

function readDateSegments(value) {
  if (Array.isArray(value)) return sortSegments(value);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return sortSegments(parsed);
  } catch {
    return parseTextSegments(value);
  }
  return parseTextSegments(value);
}

function segmentDates(segments) {
  const days = new Set();
  for (const segment of readDateSegments(segments)) {
    const start = parseDateKey(segment.start);
    const end = parseDateKey(segment.end);
    for (const day of expandDateRange(start, end)) {
      days.add(day);
    }
  }
  return [...days].sort();
}

function itemCalendarSegments(item) {
  if (item.status === "planned") return [];
  const explicitSegments = readDateSegments(item.dateSegments);
  if (explicitSegments.length) return explicitSegments;
  const start = itemStartDate(item);
  const end = itemEndDate(item);
  if (!start && !end) return [];
  return sortSegments([{ start: start || end, end: end || start }]);
}

function itemCalendarOccurrences(item) {
  return itemCalendarSegments(item).flatMap((segment) =>
    expandDateRange(parseDateKey(segment.start), parseDateKey(segment.end)).map((date) => ({
      item,
      date,
      segmentStart: segment.start,
      segmentEnd: segment.end
    }))
  );
}

function itemCalendarDates(item) {
  return itemCalendarOccurrences(item).map((entry) => entry.date);
}

function compareCalendarEntries(left, right) {
  return (
    left.segmentStart.localeCompare(right.segmentStart) ||
    left.segmentEnd.localeCompare(right.segmentEnd) ||
    String(left.item.createdAt || "").localeCompare(String(right.item.createdAt || "")) ||
    String(left.item.title || "").localeCompare(String(right.item.title || ""), "zh-Hans-CN", { numeric: true })
  );
}

function sortValue(item, key) {
  if (key === "type") return typeLabels[item.type] || item.type || "";
  if (key === "status") return statusLabels[item.status] || item.status || "";
  if (key === "creator") return primaryCreator(item);
  if (key === "cast" || key === "genres") return compact(item[key], "");
  if (key === "date") return lastSegmentDate(readDateSegments(item.dateSegments)) || itemEndDate(item);
  if (key === "rating") return Number(item.rating || 0);
  return String(item[key] || "").toLowerCase();
}

function itemDateLabel(item) {
  const segmentedDates = segmentDates(item.dateSegments);
  if (segmentedDates.length) {
    return `${segmentedDates[0]} 等 ${segmentedDates.length} 天`;
  }
  return itemStartDate(item) && itemStartDate(item) !== itemEndDate(item)
    ? `${itemStartDate(item)} - ${itemEndDate(item)}`
    : itemEndDate(item);
}

function sortedItems(items) {
  const direction = sortState.direction === "asc" ? 1 : -1;
  return [...items].sort((left, right) => {
    if (left.status === "planned" && right.status !== "planned") return -1;
    if (left.status !== "planned" && right.status === "planned") return 1;
    const leftValue = sortValue(left, sortState.key);
    const rightValue = sortValue(right, sortState.key);
    if (typeof leftValue === "number" || typeof rightValue === "number") {
      return (Number(leftValue) - Number(rightValue)) * direction;
    }
    return String(leftValue).localeCompare(String(rightValue), "zh-Hans-CN", { numeric: true }) * direction;
  });
}

function updateSortButtons() {
  sortButtons.forEach((button) => {
    const active = button.dataset.sort === sortState.key;
    button.classList.toggle("active", active);
    button.dataset.direction = active ? sortState.direction : "";
  });
}

function filteredItems() {
  const query = searchInput.value.trim().toLowerCase();
  return library.items.filter((item) => {
    const matchesType = currentFilter === "all" || item.type === currentFilter;
    const matchesStatus = currentStatusFilter === "all" || item.status === currentStatusFilter;
    const haystack = [
      item.title,
      item.subtitle,
      item.creator,
      item.director,
      item.publisher,
      item.platform,
      item.description,
      item.notes,
      item.source,
      ...(item.cast || []),
      ...(item.genres || []),
      ...(item.tags || [])
    ]
      .join(" ")
      .toLowerCase();
    return matchesType && matchesStatus && (!query || haystack.includes(query));
  });
}

function renderStats() {
  const total = library.items.length;
  const done = library.items.filter((item) => item.status === "done").length;
  const planned = library.items.filter((item) => item.status === "planned").length;
  const watching = library.items.filter((item) => item.status === "watching").length;

  statsEl.innerHTML = [
    ["all", "总记录", total],
    ["done", "已完成", done],
    ["planned", "想读/待读", planned],
    ["watching", "正在", watching]
  ]
    .map(
      ([filter, label, value]) => `
        <button class="stat ${currentStatusFilter === filter ? "active" : ""}" data-status-filter="${filter}" type="button">
          <b>${value}</b><span>${label}</span>
        </button>`
    )
    .join("");

  statsEl.querySelectorAll("[data-status-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      currentStatusFilter = button.dataset.statusFilter;
      render();
    });
  });
}

function renderItems() {
  const items = sortedItems(filteredItems());
  updateSortButtons();
  itemsEl.hidden = currentView !== "cards";
  tableWrap.hidden = currentView !== "table";
  calendarView.hidden = currentView !== "calendar";
  detailView.hidden = currentView !== "detail";
  itemsEl.innerHTML = "";
  summaryBody.innerHTML = "";
  calendarGrid.innerHTML = "";
  calendarSelection.innerHTML = "";

  if (!items.length) {
    if (currentView === "cards") {
      itemsEl.innerHTML = '<div class="empty">还没有匹配记录。输入作品名搜索后点“加入”。</div>';
    }
    if (currentView === "table") {
      summaryBody.innerHTML = '<tr><td colspan="10">还没有匹配记录。</td></tr>';
    }
    if (currentView === "calendar") {
      renderCalendar([]);
    }
    return;
  }

  if (currentView === "cards") {
    for (const item of items) renderCard(item);
  }
  if (currentView === "table") {
    for (const item of items) renderTableRow(item);
  }
  if (currentView === "calendar") {
    renderCalendar(items);
  }
}

function renderCard(item) {
  const node = itemTemplate.content.cloneNode(true);
  const image = node.querySelector(".item-image");
  const pill = node.querySelector(".pill");
  const title = node.querySelector("h3");
  const meta = node.querySelector(".meta");
  const people = node.querySelector(".people");
  const notes = node.querySelector(".notes");
  const tags = node.querySelector(".tag-list");
  const sourceLink = node.querySelector(".source-link");
  const deleteBtn = node.querySelector(".delete-btn");

  const poster = item.poster || item.image;
  if (poster) {
    setPosterImage(image, poster);
  }

  pill.textContent = `${typeLabels[item.type] || "记录"} · ${statusLabels[item.status] || ""}`;
  title.textContent = item.title;
  meta.textContent = itemMeta(item);
  people.textContent = [
    primaryCreator(item) ? `${isScreenWork(item) ? "导演" : "主创/作者"}：${primaryCreator(item)}` : "",
    item.cast?.length ? `主演：${item.cast.slice(0, 6).join(" / ")}` : ""
  ]
    .filter(Boolean)
    .join(" · ");
  notes.textContent = item.description || item.notes || "暂无简介";
  tags.innerHTML = [...(item.genres || []), ...(item.tags || [])]
    .filter(Boolean)
    .slice(0, 8)
    .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
    .join("");

  if (item.sourceUrl) {
    sourceLink.href = item.sourceUrl;
    sourceLink.textContent = `来源：${item.source || "网络资料"}`;
  } else {
    sourceLink.hidden = true;
  }

  deleteBtn.addEventListener("click", async () => {
    if (!confirm(`删除《${item.title}》？`)) return;
    library = await api(`/api/items/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    render();
  });

  node.querySelector(".item-card").addEventListener("click", (event) => {
    if (event.target.closest("button") || event.target.closest("a")) return;
    openDetail(item.id, "cards");
  });

  itemsEl.appendChild(node);
}

function renderTableRow(item) {
  const row = document.createElement("tr");
  const rangeLabel = itemDateLabel(item);
  row.tabIndex = 0;
  row.dataset.id = item.id;
  row.innerHTML = `
    <td>${escapeHtml(item.title)}</td>
    <td>${escapeHtml(typeLabels[item.type] || item.type || "记录")}</td>
    <td>${escapeHtml(item.year || "")}</td>
    <td>${escapeHtml(primaryCreator(item))}</td>
    <td>${escapeHtml(compact((item.cast || []).slice(0, 5), ""))}</td>
    <td>${escapeHtml(compact(item.genres, ""))}</td>
    <td>${escapeHtml(item.source || "")}</td>
    <td>${escapeHtml(statusLabels[item.status] || item.status || "")}</td>
    <td>${escapeHtml(rangeLabel || "")}</td>
    <td>${escapeHtml(item.rating ? `${item.rating}/10` : "")}</td>
  `;
  row.addEventListener("click", () => {
    if (tableWrap.dataset.dragMoved === "true") {
      tableWrap.dataset.dragMoved = "false";
      return;
    }
    openDetail(item.id, "table");
  });
  row.addEventListener("keydown", (event) => {
    if (event.key === "Enter") openDetail(item.id, "table");
  });
  summaryBody.appendChild(row);
}

function renderCalendar(items) {
  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();
  calendarTitle.textContent = `${year}.${String(month + 1).padStart(2, "0")}`;

  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startOffset = (first.getDay() + 6) % 7;
  const totalCells = Math.ceil((startOffset + last.getDate()) / 7) * 7;
  const currentTodayKey = todayKey();
  const byDate = new Map();

  for (const item of items) {
    for (const entry of itemCalendarOccurrences(item)) {
      if (!byDate.has(entry.date)) byDate.set(entry.date, []);
      byDate.get(entry.date).push(entry);
    }
  }

  for (const entries of byDate.values()) {
    entries.sort(compareCalendarEntries);
  }

  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const eventDatesInMonth = [...byDate.keys()].filter((date) => date.startsWith(monthPrefix)).sort();
  if (!selectedCalendarDate || !selectedCalendarDate.startsWith(monthPrefix)) {
    selectedCalendarDate = eventDatesInMonth[0] || `${monthPrefix}-01`;
  }

  for (let index = 0; index < totalCells; index += 1) {
    const dayNumber = index - startOffset + 1;
    const cell = document.createElement("div");
    cell.className = "calendar-day";

    if (dayNumber < 1 || dayNumber > last.getDate()) {
      cell.classList.add("muted-day");
      calendarGrid.appendChild(cell);
      continue;
    }

    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`;
    if (dateKey === currentTodayKey) cell.classList.add("today");
    if (dateKey === selectedCalendarDate) cell.classList.add("selected-day");
    cell.innerHTML = `<button class="day-number" type="button">${dayNumber}</button><div class="day-events"></div>`;
    cell.querySelector(".day-number").addEventListener("click", () => {
      selectedCalendarDate = dateKey;
      renderItems();
    });

    const events = cell.querySelector(".day-events");
    for (const entry of byDate.get(dateKey) || []) {
      const item = entry.item;
      const event = document.createElement("button");
      event.type = "button";
      event.className = "calendar-event";
      const poster = item.poster || item.image;
      if (poster) {
        const image = document.createElement("img");
        image.alt = item.title;
        event.appendChild(image);
        setPosterImage(image, poster, () => {
          image.remove();
          event.textContent = item.title.slice(0, 2);
        });
      } else {
        event.textContent = item.title.slice(0, 2);
      }
      event.title = item.title;
      event.addEventListener("click", () => openDetail(item.id, "calendar"));
      events.appendChild(event);
    }

    calendarGrid.appendChild(cell);
  }

  renderCalendarSelection(byDate.get(selectedCalendarDate) || []);
}

function renderCalendarSelection(entries) {
  const dateLabel = selectedCalendarDate || "未选择日期";
  if (!entries.length) {
    calendarSelection.innerHTML = `<h3>${escapeHtml(dateLabel)}</h3><p class="empty small">这一天还没有记录。</p>`;
    return;
  }

  calendarSelection.innerHTML = `<h3>${escapeHtml(dateLabel)}</h3>`;
  for (const entry of entries) {
    const item = entry.item || entry;
    const row = document.createElement("button");
    row.type = "button";
    row.className = "calendar-selection-item";
    const poster = item.poster || item.image;
    row.innerHTML = `
      ${poster ? `<img alt="">` : `<span class="selection-placeholder">${escapeHtml(item.title.slice(0, 2))}</span>`}
      <span>
        <b>${escapeHtml(item.title)}</b>
        <small>${escapeHtml(typeLabels[item.type] || "记录")} · ${escapeHtml(statusLabels[item.status] || "")}${item.rating ? ` · ${escapeHtml(`${item.rating}/10`)}` : ""}</small>
      </span>
    `;
    const rowImage = row.querySelector("img");
    if (rowImage) {
      setPosterImage(rowImage, poster, () => {
        const placeholder = document.createElement("span");
        placeholder.className = "selection-placeholder";
        placeholder.textContent = item.title.slice(0, 2);
        rowImage.replaceWith(placeholder);
      });
    }
    row.addEventListener("click", () => openDetail(item.id, "calendar"));
    calendarSelection.appendChild(row);
  }
}

function splitList(value) {
  return String(value || "")
    .split(/[\/,，、\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function firstSegmentDate(segments) {
  return sortSegments(segments)[0]?.start || "";
}

function lastSegmentDate(segments) {
  const sorted = sortSegments(segments);
  return sorted[sorted.length - 1]?.end || "";
}

function segmentLabel(segment) {
  return segment.start === segment.end ? segment.start : `${segment.start} - ${segment.end}`;
}

function syncDateInputs(form, segments) {
  const sorted = sortSegments(segments);
  form.elements.dateSegments.value = JSON.stringify(sorted);
  form.elements.startDate.value = firstSegmentDate(sorted);
  if (form.elements.status.value === "watching") {
    form.elements.date.value = "";
    form.elements.endDate.value = "";
  } else {
    form.elements.date.value = lastSegmentDate(sorted);
    form.elements.endDate.value = lastSegmentDate(sorted);
  }
}

function getDatePickerState(form) {
  const key = form.id;
  if (!datePickerStates.has(key)) {
    datePickerStates.set(key, {
      cursor: new Date(),
      mode: "single",
      pendingStart: "",
      segments: []
    });
  }
  return datePickerStates.get(key);
}

function dateInSegment(date, segment) {
  return date >= segment.start && date <= segment.end;
}

function addOrRemoveSegment(segments, nextSegment) {
  const normalized = normalizeSegment(nextSegment);
  if (!normalized) return sortSegments(segments);
  const existingIndex = segments.findIndex((segment) => dateInSegment(normalized.start, segment));
  if (existingIndex >= 0) {
    return sortSegments(segments.filter((_, index) => index !== existingIndex));
  }
  return sortSegments([...segments, normalized]);
}

function setDatePickerSegments(form, segments) {
  const state = getDatePickerState(form);
  state.segments = sortSegments(segments);
  syncDateInputs(form, state.segments);
  renderDatePicker(form);
}

function renderDatePicker(form) {
  const picker = form === manualForm ? manualDatePicker : detailDatePicker;
  if (!picker) return;
  const state = getDatePickerState(form);
  const status = form.elements.status.value;
  const disabled = status === "planned";
  const year = state.cursor.getFullYear();
  const month = state.cursor.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startOffset = (first.getDay() + 6) % 7;
  const totalCells = Math.ceil((startOffset + last.getDate()) / 7) * 7;
  const title = picker.querySelector("[data-calendar-title]");
  const grid = picker.querySelector("[data-calendar-grid]");
  const selected = picker.querySelector("[data-selected-segments]");

  picker.classList.toggle("disabled-picker", disabled);
  title.textContent = `${year}.${String(month + 1).padStart(2, "0")}`;
  grid.innerHTML = "";

  for (let index = 0; index < totalCells; index += 1) {
    const dayNumber = index - startOffset + 1;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mini-day";

    if (dayNumber < 1 || dayNumber > last.getDate()) {
      button.classList.add("muted-day");
      button.disabled = true;
      grid.appendChild(button);
      continue;
    }

    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`;
    button.textContent = dayNumber;
    button.disabled = disabled;
    if (key === todayKey()) button.classList.add("today");
    if (state.pendingStart === key) button.classList.add("pending-day");
    if (!disabled && state.segments.some((segment) => dateInSegment(key, segment))) button.classList.add("selected");
    button.addEventListener("click", () => {
      if (!state.pendingStart && state.segments.some((segment) => dateInSegment(key, segment))) {
        state.segments = addOrRemoveSegment(state.segments, { start: key, end: key });
      } else if (state.mode === "single") {
        state.segments = addOrRemoveSegment(state.segments, { start: key, end: key });
      } else if (!state.pendingStart) {
        state.pendingStart = key;
      } else {
        state.segments = addOrRemoveSegment(state.segments, { start: state.pendingStart, end: key });
        state.pendingStart = "";
      }
      syncDateInputs(form, state.segments);
      renderDatePicker(form);
    });
    grid.appendChild(button);
  }

  const sorted = sortSegments(state.segments);
  if (disabled) {
    selected.innerHTML = '<p class="date-picker-note">想读/待读不会进入日历。</p>';
    return;
  }
  if (!sorted.length) {
    selected.innerHTML = '<p class="date-picker-note">选择单日，或切到区间后选择开始和结束日期。</p>';
    return;
  }

  selected.innerHTML = sorted
    .map(
      (segment, index) => `
        <button class="selected-segment" data-remove-segment="${index}" type="button">
          <span>${escapeHtml(segmentLabel(segment))}</span>
          <b>删除</b>
        </button>`
    )
    .join("");

  selected.querySelectorAll("[data-remove-segment]").forEach((button) => {
    button.addEventListener("click", () => {
      state.segments = sorted.filter((_, index) => index !== Number(button.dataset.removeSegment));
      syncDateInputs(form, state.segments);
      renderDatePicker(form);
    });
  });
}

function initDatePicker(form, picker) {
  const state = getDatePickerState(form);
  picker.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      state.pendingStart = "";
      picker.querySelectorAll("[data-mode]").forEach((item) => item.classList.toggle("active", item === button));
      renderDatePicker(form);
    });
  });
  picker.querySelector("[data-calendar-prev]").addEventListener("click", () => {
    state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() - 1, 1);
    renderDatePicker(form);
  });
  picker.querySelector("[data-calendar-next]").addEventListener("click", () => {
    state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() + 1, 1);
    renderDatePicker(form);
  });
  renderDatePicker(form);
}

function normalizeDatesForStatus(payload) {
  const next = { ...payload };
  next.dateSegments = readDateSegments(next.dateSegments);
  if (next.status === "planned") {
    next.startDate = "";
    next.endDate = "";
    next.date = "";
    next.dateSegments = [];
    return next;
  }
  if (next.status === "watching") {
    next.startDate = firstSegmentDate(next.dateSegments) || next.startDate || todayKey();
    next.endDate = "";
    next.date = "";
    return next;
  }
  next.endDate = lastSegmentDate(next.dateSegments) || next.endDate || next.date || "";
  next.date = next.date || next.endDate || "";
  return next;
}

function updateDateFieldState(form) {
  const status = form.elements.status?.value;
  const picker = form === manualForm ? manualDatePicker : detailDatePicker;
  picker?.classList.toggle("disabled-picker", status === "planned");
  renderDatePicker(form);
}

function setActiveViewButton(view) {
  viewButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
}

function switchView(view) {
  currentView = view;
  if (view !== "detail") selectedItemId = "";
  setActiveViewButton(view);
  renderItems();
}

function openDetail(id, fromView = currentView) {
  const item = library.items.find((entry) => entry.id === id);
  if (!item) return;
  previousView = ["cards", "calendar"].includes(fromView) ? fromView : "table";
  selectedItemId = id;
  currentView = "detail";
  setActiveViewButton("");
  fillDetailForm(item);
  renderItems();
}

function fillDetailForm(item) {
  detailForm.elements.title.value = item.title || "";
  detailForm.elements.type.value = item.type || "book";
  detailForm.elements.year.value = item.year || "";
  detailForm.elements.rating.value = item.rating || "";
  detailForm.elements.creator.value = item.creator || "";
  detailForm.elements.director.value = item.director || "";
  detailForm.elements.cast.value = compact(item.cast, "");
  detailForm.elements.genres.value = compact(item.genres, "");
  detailForm.elements.status.value = item.status || "done";
  detailForm.elements.date.value = item.date || "";
  detailForm.elements.startDate.value = item.startDate || "";
  detailForm.elements.endDate.value = item.endDate || item.date || "";
  detailForm.elements.dateSegments.value = JSON.stringify(readDateSegments(item.dateSegments));
  detailForm.elements.poster.value = item.poster || item.image || "";
  detailForm.elements.sourceUrl.value = item.sourceUrl || "";
  detailForm.elements.description.value = item.description || "";
  detailForm.elements.notes.value = item.notes || "";
  setPosterImage(detailPosterPreview, item.poster || item.image || "");
  setDatePickerSegments(detailForm, readDateSegments(item.dateSegments));
  updateDateFieldState(detailForm);
}

async function saveDetail(event) {
  event.preventDefault();
  if (!selectedItemId) return;
  const formData = new FormData(detailForm);
  const payload = normalizeDatesForStatus({
    title: formData.get("title"),
    type: formData.get("type"),
    year: formData.get("year"),
    rating: formData.get("rating"),
    creator: formData.get("creator"),
    director: formData.get("director"),
    cast: splitList(formData.get("cast")),
    genres: splitList(formData.get("genres")),
    status: formData.get("status"),
    date: formData.get("date"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") || formData.get("date"),
    dateSegments: formData.get("dateSegments"),
    poster: formData.get("poster"),
    image: formData.get("poster"),
    sourceUrl: formData.get("sourceUrl"),
    description: formData.get("description"),
    notes: formData.get("notes")
  });
  library = await api(`/api/items/${encodeURIComponent(selectedItemId)}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
  const savedId = selectedItemId;
  openDetail(savedId, previousView);
}

function renderResults() {
  lookupResults.innerHTML = "";
  if (!lastResults.length) {
    lookupResults.innerHTML = '<div class="empty small">没有找到候选结果，可以换个中文名、英文名或加上作者/导演再搜。</div>';
    return;
  }

  for (const result of lastResults) {
    const node = resultTemplate.content.cloneNode(true);
    const image = node.querySelector(".result-poster");
    const pill = node.querySelector(".pill");
    const title = node.querySelector("h3");
    const meta = node.querySelector(".meta");
    const notes = node.querySelector(".notes");
    const addBtn = node.querySelector(".add-result");

    if (result.poster) {
      setPosterImage(image, result.poster);
    }

    pill.textContent = `${typeLabels[result.type] || "记录"} · ${result.source}`;
    title.textContent = result.title;
    meta.textContent = [
      result.year,
      result.creator || result.director,
      compact(result.genres, "")
    ]
      .filter(Boolean)
      .join(" · ");
    notes.textContent = result.description || result.subtitle || "暂无简介";

    addBtn.addEventListener("click", () => addResult(result));
    lookupResults.appendChild(node);
  }
}

async function addResult(result) {
  const today = todayKey();
  const payload = {
    ...result,
    status: "done",
    date: today,
    endDate: today,
    dateSegments: [{ start: today, end: today }],
    rating: 0
  };
  library = await api("/api/items", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  lookupResults.innerHTML = `<div class="empty small">已加入《${escapeHtml(result.title)}》。</div>`;
  lastResults = [];
  render();
}

function render() {
  renderStats();
  renderItems();
}

function setCloudState(title, hint) {
  cloudStatus.textContent = title;
  cloudHint.textContent = hint;
}

function formatAuthError(error) {
  const message = String(error?.message || "");
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes("invalid login credentials")) return "邮箱或密码不正确。";
  if (lowerMessage.includes("email not confirmed")) return "邮箱尚未确认，请先在 Supabase 中确认该用户。";
  if (lowerMessage.includes("rate limit")) return "登录尝试过于频繁，请稍后再试。";
  return message || "登录失败，请稍后再试。";
}

function updateAuthUi() {
  appHeader.classList.toggle("login-mode", Boolean(supabaseClient) && !isCloudReady);
  loginForm.hidden = isCloudReady;
  logoutBtn.hidden = !isCloudReady;
  syncBtn.hidden = !isCloudReady;
  appContent.hidden = Boolean(supabaseClient) && !isCloudReady;
  headerActions.hidden = Boolean(supabaseClient) && !isCloudReady;

  if (isCloudReady) {
    setCloudState("云同步已开启", `${currentUser.email} · ${library.items.length} 条记录`);
  } else if (supabaseClient) {
    setCloudState("请登录", "");
  } else {
    setCloudState("本地模式", "未配置 Supabase，数据仅保存在当前浏览器中。");
  }
}

async function refreshCloudLibrary() {
  if (!isCloudReady) return;
  if (cloudLoadPromise) return cloudLoadPromise;
  setCloudState("正在同步", "正在读取 Supabase 中的记录。");
  cloudLoadPromise = readCloudLibrary()
    .then((nextLibrary) => {
      library = nextLibrary;
      render();
      updateAuthUi();
      return library;
    })
    .finally(() => {
      cloudLoadPromise = null;
    });
  return cloudLoadPromise;
}

async function signIn(email, password) {
  if (!supabaseClient) return;
  loginBtn.disabled = true;
  setCloudState("正在登录", "正在连接 Supabase。");
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  loginBtn.disabled = false;
  if (error) {
    setCloudState("登录失败", formatAuthError(error));
    return;
  }
  passwordInput.value = "";
  currentUser = data.user;
  isCloudReady = Boolean(currentUser);
  updateAuthUi();
  await refreshCloudLibrary();
  await importCaptureFromUrl();
}

async function signOut() {
  if (supabaseClient) await supabaseClient.auth.signOut();
  clearPosterCache();
  currentUser = null;
  isCloudReady = false;
  library = { items: [] };
  render();
  updateAuthUi();
}

async function importCaptureFromUrl() {
  const url = new URL(window.location.href);
  const encoded = url.searchParams.get("capture");
  if (!encoded || !isCloudReady) return;
  try {
    const payload = JSON.parse(decodeURIComponent(escape(atob(encoded))));
    const duplicate = library.items.find((item) => item.sourceId && item.sourceId === payload.sourceId);
    if (duplicate) {
      lookupResults.innerHTML = `<div class="empty small">《${escapeHtml(duplicate.title)}》已经在记录库中。</div>`;
    } else {
      library = await api("/api/items", { method: "POST", body: JSON.stringify(payload) });
      lookupResults.innerHTML = `<div class="empty small">已从豆瓣加入《${escapeHtml(payload.title)}》。</div>`;
      render();
    }
    url.searchParams.delete("capture");
    history.replaceState(null, "", url.href);
  } catch (error) {
    modeBanner.hidden = false;
    modeBanner.textContent = `豆瓣采集失败：${error.message}`;
  }
}

async function initCloud() {
  if (!supabaseClient) {
    appContent.hidden = false;
    updateAuthUi();
    library = await api("/api/library");
    render();
    return;
  }

  const { data, error } = await supabaseClient.auth.getUser();
  if (error && !/session/i.test(error.message || "")) {
    setCloudState("连接失败", formatAuthError(error));
  }
  currentUser = data?.user || null;
  isCloudReady = Boolean(currentUser);
  updateAuthUi();

  supabaseClient.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;
    isCloudReady = Boolean(currentUser);
    updateAuthUi();
    if (event === "SIGNED_IN" && isCloudReady && !cloudLoadPromise) {
      refreshCloudLibrary().then(importCaptureFromUrl).catch((authError) => {
        setCloudState("同步失败", authError.message);
      });
    }
  });

  if (isCloudReady) {
    await refreshCloudLibrary();
    await importCaptureFromUrl();
  }
}

async function load() {
  if (isFileMode && !supabaseClient) {
    modeBanner.hidden = false;
    modeBanner.textContent =
      "当前是本地预览模式，数据只保存在这个浏览器中。";
  }
  doubanBookmarklet.href = `javascript:${encodeURIComponent(bookmarkletCode)}`;
  updateCaptureLayout();
  initDatePicker(manualForm, manualDatePicker);
  initDatePicker(detailForm, detailDatePicker);
  updateDateFieldState(manualForm);
  await initCloud();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await signIn(emailInput.value.trim(), passwordInput.value);
});

logoutBtn.addEventListener("click", signOut);
syncBtn.addEventListener("click", () => {
  refreshCloudLibrary().catch((error) => setCloudState("同步失败", error.message));
});
capturePanel.addEventListener("toggle", updateCaptureLayout);

manualForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(manualForm);
  const title = String(formData.get("title") || "").trim();
  if (!title) return;
  const date = formData.get("date") || "";
  const payload = normalizeDatesForStatus({
    type: formData.get("type"),
    title,
    year: formData.get("year"),
    status: formData.get("status"),
    rating: Number(formData.get("rating") || 0),
    startDate: formData.get("startDate"),
    endDate: date,
    date,
    dateSegments: formData.get("dateSegments"),
    poster: formData.get("poster"),
    image: formData.get("poster"),
    notes: formData.get("notes"),
    source: "手动添加"
  });
  try {
    library = await api("/api/items", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    lookupResults.innerHTML = `<div class="empty small">已添加《${escapeHtml(title)}》。</div>`;
    manualForm.reset();
    setDatePickerSegments(manualForm, []);
    updateDateFieldState(manualForm);
    render();
  } catch (error) {
    lookupResults.innerHTML = `<div class="empty small">${escapeHtml(error.message)}</div>`;
  }
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    currentFilter = button.dataset.filter;
    renderItems();
  });
});

viewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    switchView(button.dataset.view);
  });
});

sortButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.dataset.sort;
    sortState = {
      key,
      direction: sortState.key === key && sortState.direction === "asc" ? "desc" : "asc"
    };
    renderItems();
  });
});

let tableDrag = null;
tableWrap.addEventListener("pointerdown", (event) => {
  if (event.target.closest("button, a, input, select, textarea")) return;
  tableDrag = {
    x: event.clientX,
    scrollLeft: tableWrap.scrollLeft,
    moved: false
  };
  tableWrap.setPointerCapture(event.pointerId);
});

tableWrap.addEventListener("pointermove", (event) => {
  if (!tableDrag) return;
  const delta = event.clientX - tableDrag.x;
  if (Math.abs(delta) > 4) tableDrag.moved = true;
  tableWrap.scrollLeft = tableDrag.scrollLeft - delta;
});

tableWrap.addEventListener("pointerup", (event) => {
  if (tableDrag) {
    tableWrap.dataset.dragMoved = tableDrag.moved ? "true" : "false";
  }
  tableDrag = null;
  tableWrap.releasePointerCapture(event.pointerId);
});

searchInput.addEventListener("input", renderItems);

detailForm.elements.poster.addEventListener("input", () => {
  setPosterImage(detailPosterPreview, detailForm.elements.poster.value);
});

manualForm.elements.status.addEventListener("change", () => updateDateFieldState(manualForm));
detailForm.elements.status.addEventListener("change", () => updateDateFieldState(detailForm));
detailForm.addEventListener("submit", saveDetail);

backToTableBtn.addEventListener("click", () => switchView("table"));
backToCardsBtn.addEventListener("click", () => switchView("cards"));
backToCalendarBtn.addEventListener("click", () => switchView("calendar"));

prevMonthBtn.addEventListener("click", () => {
  calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1);
  renderItems();
});

nextMonthBtn.addEventListener("click", () => {
  calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1);
  renderItems();
});

deleteDetailBtn.addEventListener("click", async () => {
  if (!selectedItemId) return;
  const item = library.items.find((entry) => entry.id === selectedItemId);
  if (!confirm(`删除《${item?.title || "这条记录"}》？`)) return;
  library = await api(`/api/items/${encodeURIComponent(selectedItemId)}`, { method: "DELETE" });
  switchView(previousView);
});

exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(library, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `media-library-${todayKey()}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

importInput.addEventListener("change", async () => {
  const file = importInput.files[0];
  if (!file) return;
  const text = await file.text();
  library = await api("/api/import", {
    method: "POST",
    body: text
  });
  importInput.value = "";
  render();
});

load().catch((error) => {
  itemsEl.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
});
