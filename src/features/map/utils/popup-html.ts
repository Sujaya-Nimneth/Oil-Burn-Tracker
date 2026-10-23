// Shared HTML builders for MapLibre popups.
//
// Popups are injected via Popup#setHTML, so every piece of external data
// (RSS headline titles/descriptions, source URLs, facility text) MUST go
// through escapeHtml()/sanitizeUrl() here — unescaped markup would execute.

export function escapeHtml(text: unknown): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Only http(s) links are allowed — blocks javascript:/data: URLs from
// ever being rendered as clickable links.
export function sanitizeUrl(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : '';
  } catch {
    return '';
  }
}

export function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function formatEventDate(date?: string): string {
  if (!date) return '';
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// YouTube embed + sound toggle. videoId is constrained to [a-zA-Z0-9_-]{11}
// by getYouTubeId, so it is safe to interpolate directly.
function embedYouTube(videoId: string, iframePrefix: string, isMuted: boolean): string {
  const iframeId = `${iframePrefix}-yt-${videoId}`;
  let html = `<div style="position:relative;width:100%;padding-bottom:56.25%;margin-bottom:4px;border-radius:6px;overflow:hidden;background:#000">`;
  html += `<iframe id="${iframeId}" src="https://www.youtube-nocookie.com/embed/${videoId}?rel=0&autoplay=1&mute=${isMuted ? 1 : 0}&enablejsapi=1" `;
  html += `style="position:absolute;top:0;left:0;width:100%;height:100%;border:none" `;
  html += `allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen></iframe>`;
  html += `</div>`;
  html += `<button id="${iframePrefix}-vol-toggle" onclick="(function(){var f=document.getElementById('${iframeId}');var b=document.getElementById('${iframePrefix}-vol-toggle');if(!f)return;var m=b.dataset.muted!=='false';var cmd=m?'unMute':'mute';f.contentWindow.postMessage(JSON.stringify({event:'command',func:cmd,args:''}),'*');b.dataset.muted=m?'false':'true';b.textContent=m?'\ud83d\udd0a Sound On':'\ud83d\udd07 Muted'})()" `;
  html += `data-muted="${isMuted}" style="display:block;width:100%;padding:6px;margin-bottom:6px;border:1px solid rgba(255,255,255,0.15);border-radius:6px;background:rgba(255,255,255,0.05);color:#e0e0e0;font-size:12px;font-weight:600;cursor:pointer;text-align:center">${isMuted ? '\ud83d\udd07 Muted \u2014 Tap to unmute' : '\ud83d\udd0a Sound On'}</button>`;
  return html;
}

function popupShell(inner: string): string {
  return `<div style="font-family:system-ui;color:#e0e0e0;background:#1a1a1a;padding:10px;border-radius:8px;box-sizing:border-box">${inner}</div>`;
}

export interface EventPopupData {
  category: string;
  color: string;
  date?: string;
  title: string;
  description: string;
  killed?: number;
  displaced?: number;
  videoId?: string | null;
  sourceUrl?: string;
}

export function buildEventPopupHtml(data: EventPopupData, isMuted: boolean): string {
  let inner = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span style="font-size:11px;color:${data.color};font-weight:700;text-transform:uppercase">${escapeHtml(data.category.replace('_', ' '))}</span><span style="font-size:11px;color:#999;font-weight:600">${escapeHtml(formatEventDate(data.date))}</span></div>`;
  inner += `<div style="font-size:13px;font-weight:800;line-height:1.3;margin-bottom:4px">${escapeHtml(data.title)}</div>`;
  inner += `<div style="font-size:11px;opacity:0.75;line-height:1.4;margin-bottom:6px">${escapeHtml(data.description.slice(0, 200))}...</div>`;

  if (data.killed && data.killed > 0) {
    inner += `<div style="font-size:11px;color:#ef4444;font-weight:700;margin-bottom:6px">${data.killed.toLocaleString()}+ killed</div>`;
  }
  if (data.displaced && data.displaced > 0) {
    inner += `<div style="font-size:11px;color:#f59e0b;font-weight:600;margin-bottom:6px">${data.displaced.toLocaleString()} displaced</div>`;
  }

  if (data.videoId) {
    inner += embedYouTube(data.videoId, 'pin', isMuted);
  }

  const sourceUrl = sanitizeUrl(data.sourceUrl);
  if (sourceUrl) {
    inner += `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:#60a5fa;text-decoration:underline">Read more</a>`;
  }

  return popupShell(inner);
}

const STATUS_COLORS: Record<string, string> = {
  active_fire: '#ef4444',
  damaged: '#f97316',
  monitoring: '#eab308',
  offline: '#6b7280',
  operational: '#22c55e'
};

const STATUS_LABELS: Record<string, string> = {
  active_fire: 'ACTIVE FIRE',
  damaged: 'DAMAGED',
  monitoring: 'MONITORING',
  offline: 'OFFLINE',
  operational: 'OPERATIONAL'
};

const TYPE_LABELS: Record<string, string> = {
  refinery: 'Refinery',
  lng_terminal: 'LNG Terminal',
  pipeline: 'Pipeline',
  storage: 'Oil Storage',
  oil_field: 'Oil Field',
  gas_field: 'Gas Field',
  port: 'Port'
};

export interface FacilityPopupData {
  name: string;
  country: string;
  facilityType: string;
  status: string;
  attackDate?: string;
  capacityBPD: number;
  gasCapacityBCFD?: number;
  lngMTPA?: number;
  storageMBBL?: number;
  percentGlobalCapacity: number;
  whyItMatters: string;
  ifDestroyed: string;
  newsSourceUrl?: string;
  videoId?: string | null;
}

export function buildFacilityPopupHtml(f: FacilityPopupData, isMuted: boolean): string {
  const sColor = STATUS_COLORS[f.status] || '#999';
  const dateStr = f.attackDate ? formatEventDate(f.attackDate) : '';

  let inner = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">`;
  inner += `<span style="font-size:10px;color:${sColor};font-weight:700;letter-spacing:0.5px">${escapeHtml(STATUS_LABELS[f.status] || f.status)}</span>`;
  if (dateStr) inner += `<span style="font-size:11px;color:#999;font-weight:600">${escapeHtml(dateStr)}</span>`;
  inner += `</div>`;
  inner += `<div style="font-size:14px;font-weight:800;line-height:1.3;margin-bottom:2px">${escapeHtml(f.name)}</div>`;
  inner += `<div style="font-size:11px;color:#999;margin-bottom:6px">${escapeHtml(f.country)} · ${escapeHtml(TYPE_LABELS[f.facilityType] || f.facilityType)}</div>`;

  if (f.videoId) {
    inner += embedYouTube(f.videoId, 'fac', isMuted);
  }

  // Scrolling data ticker
  const stats: string[] = [];
  if (f.capacityBPD > 0) stats.push(`${(f.capacityBPD / 1000).toFixed(0)}K BPD`);
  if (f.percentGlobalCapacity > 0) stats.push(`${f.percentGlobalCapacity}% global supply`);
  if (f.gasCapacityBCFD) stats.push(`${f.gasCapacityBCFD} BCF/day gas`);
  if (f.lngMTPA) stats.push(`${f.lngMTPA}M tons/yr LNG`);
  if (f.storageMBBL) stats.push(`${f.storageMBBL}M bbl storage`);
  const ticker = stats.join('  ·  ');
  if (ticker) {
    inner += `<div style="overflow:hidden;white-space:nowrap;margin-bottom:6px;padding:4px 0;border-top:1px solid rgba(255,255,255,0.1);border-bottom:1px solid rgba(255,255,255,0.1)">`;
    inner += `<div style="display:inline-block;animation:tickerScroll 12s linear infinite;font-size:11px;font-weight:700;color:#f59e0b;font-family:monospace">${escapeHtml(ticker)}  ·  ${escapeHtml(ticker)}  ·  ${escapeHtml(ticker)}</div>`;
    inner += `</div>`;
  }

  inner += `<div style="font-size:11px;opacity:0.85;line-height:1.4;margin-bottom:4px">${escapeHtml(f.whyItMatters)}</div>`;
  inner += `<div style="font-size:11px;color:#ef4444;line-height:1.4;margin-bottom:6px">${escapeHtml(f.ifDestroyed)}</div>`;

  const newsUrl = sanitizeUrl(f.newsSourceUrl);
  if (newsUrl) {
    inner += `<a href="${escapeHtml(newsUrl)}" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:#60a5fa;text-decoration:underline">News source</a>`;
  }

  return popupShell(inner);
}

export interface FirePopupData {
  frp: number;
  estimatedCO2TonsDay: number;
  satellite: string;
  acqDate: string;
  acqTime: string;
}

export function buildFirePopupHtml(d: FirePopupData): string {
  return popupShell(
    `<div style="font-family:system-ui;font-size:12px;color:#e0e0e0;background:#1a1a1a;padding:8px;border-radius:6px">` +
      `<strong>FRP:</strong> ${d.frp.toFixed(1)} MW &middot;` +
      `<strong>CO&#8322;:</strong> ~${d.estimatedCO2TonsDay.toFixed(0)} t/day<br/>` +
      `<span style="opacity:0.7">${escapeHtml(d.satellite)} &middot; ${escapeHtml(d.acqDate)} ${escapeHtml(d.acqTime)}</span>` +
      `</div>`
  );
}
