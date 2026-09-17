const STAGE_LABELS = Object.freeze({
  not_started: '미착수',
  ui_only: 'UI만',
  ui_mock: 'UI + 목업',
  api_connected: 'API 연결',
  verified: '검증 완료',
  blocked: '중단',
});

const AXIS_LABELS = Object.freeze({
  planning: {
    complete: '구성 완료',
    partial: '일부 구성',
    missing: '없음',
    unknown: '확인 필요',
  },
  design: {
    complete: '이미지 완비',
    partial: '일부 누락',
    missing: '매핑 없음',
    unknown: '확인 필요',
  },
  api: {
    complete: '완전 연결',
    partial: '부분 연결',
    mock: '목업',
    declared: '계약만 존재',
    missing: '없음',
    not_applicable: '비대상',
    unknown: '확인 필요',
  },
  implementation: {
    complete: '구현됨',
    partial: '부분 구현',
    missing: '미구현',
    deferred: '보류',
    not_applicable: '비대상',
    unknown: '확인 필요',
  },
});

const AREA_LABELS = Object.freeze({ common: '공통', guest: '게스트', host: '호스트' });
const RISK_ORDER = Object.freeze({ blocked: 6, not_started: 5, ui_only: 4, ui_mock: 3, api_connected: 2, verified: 1 });

export function formatProgress(value) {
  return value == null ? '미산정' : `${value}%`;
}

export function stageLabel(value) {
  return STAGE_LABELS[value] ?? '확인 필요';
}

export function axisLabel(axis, value) {
  return AXIS_LABELS[axis]?.[value] ?? '확인 필요';
}

export function dashboardDataUrl(moduleUrl = import.meta.url) {
  return new URL('./data.json', moduleUrl).href;
}

export function filterPages(pages, filters) {
  const query = filters.query.trim().toLocaleLowerCase('ko-KR');
  return pages.filter((page) => {
    if (filters.area !== 'all' && page.area !== filters.area) return false;
    if (filters.stage === 'blocked' && !page.blocked) return false;
    if (filters.stage !== 'all' && filters.stage !== 'blocked' && page.stage !== filters.stage) return false;
    if (filters.planning !== 'all' && page.planning !== filters.planning) return false;
    if (filters.design !== 'all' && page.design !== filters.design) return false;
    if (filters.api !== 'all' && page.api !== filters.api) return false;
    return !query || `${page.name} ${(page.notes ?? []).join(' ')}`.toLocaleLowerCase('ko-KR').includes(query);
  });
}

export function sortPages(pages, sort) {
  const result = [...pages];
  result.sort((left, right) => {
    if (sort === 'progress_desc') {
      return (right.progress ?? -1) - (left.progress ?? -1) || left.name.localeCompare(right.name, 'ko');
    }
    if (sort === 'updated_desc') {
      return (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '') || left.name.localeCompare(right.name, 'ko');
    }
    if (sort === 'name') return left.name.localeCompare(right.name, 'ko');
    const leftRisk = left.blocked ? RISK_ORDER.blocked : (RISK_ORDER[left.stage] ?? 0);
    const rightRisk = right.blocked ? RISK_ORDER.blocked : (RISK_ORDER[right.stage] ?? 0);
    return rightRisk - leftRisk || left.name.localeCompare(right.name, 'ko');
  });
  return result;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function badge(value, label) {
  return `<span class="badge ${escapeHtml(value)}">${escapeHtml(label)}</span>`;
}

function progressMarkup(page) {
  const width = page.progress == null ? 0 : Math.max(0, Math.min(100, page.progress));
  return `<div class="progress-cell"><strong>${formatProgress(page.progress)}</strong><span class="progress-track" aria-hidden="true"><span style="width:${width}%"></span></span></div>`;
}

function summaryCards(summary) {
  const missingApi = (summary.byApi?.missing ?? 0) + (summary.byApi?.declared ?? 0);
  const incompleteDesign = (summary.byDesign?.missing ?? 0) + (summary.byDesign?.partial ?? 0);
  const cards = [
    ['검토 요구사항 기준 진행률', formatProgress(summary.reviewedProgress), 'primary'],
    ['전체 페이지', `${summary.totalPages}개`, ''],
    ['검증 완료', `${summary.byStage?.verified ?? 0}개`, ''],
    ['UI·목업 단계', `${(summary.byStage?.ui_only ?? 0) + (summary.byStage?.ui_mock ?? 0)}개`, ''],
    ['API 미구성', `${missingApi}개`, ''],
    ['디자인 보완 필요', `${incompleteDesign}개`, ''],
    ['중단', `${summary.blockedPages ?? 0}개`, ''],
  ];
  return cards
    .map(([label, value, className]) => `<article class="summary-card ${className}"><span>${label}</span><strong>${value}</strong></article>`)
    .join('');
}

function pageRow(page) {
  const note = page.notes[0] ?? '특이사항 없음';
  const stageBadges = [badge(page.stage, stageLabel(page.stage))];
  if (page.blocked) stageBadges.push(badge('blocked', '중단'));
  return `<tr>
    <td data-label="페이지"><button class="page-button" type="button" data-page-id="${escapeHtml(page.id)}"><strong>${escapeHtml(page.name)}</strong><span>${escapeHtml(AREA_LABELS[page.area] ?? page.area)}</span></button></td>
    <td data-label="진행도">${progressMarkup(page)}</td>
    <td data-label="기획">${badge(page.planning, axisLabel('planning', page.planning))}</td>
    <td data-label="디자인">${badge(page.design, axisLabel('design', page.design))}</td>
    <td data-label="API">${badge(page.api, axisLabel('api', page.api))}</td>
    <td data-label="현재 단계"><span class="badge-stack">${stageBadges.join('')}</span></td>
    <td data-label="특이사항" class="notes-cell">${escapeHtml(note)}</td>
  </tr>`;
}

function detailMarkup(page) {
  const notes = page.notes.length > 0 ? page.notes : ['특이사항 없음'];
  return `<div class="detail-progress"><strong>${formatProgress(page.progress)}</strong>${progressMarkup(page)}</div>
    <div class="detail-grid">
      <div class="detail-item"><span>현재 진행 상황</span><strong>${stageLabel(page.stage)}${page.blocked ? ' · 중단' : ''}</strong></div>
      <div class="detail-item"><span>검토 범위</span><strong>${page.reviewScope === 'reviewed' ? '전수 검토' : '미산정'}</strong></div>
      <div class="detail-item"><span>기획</span><strong>${axisLabel('planning', page.planning)}</strong></div>
      <div class="detail-item"><span>디자인</span><strong>${axisLabel('design', page.design)}</strong></div>
      <div class="detail-item"><span>API</span><strong>${axisLabel('api', page.api)}</strong></div>
      <div class="detail-item"><span>구현</span><strong>${axisLabel('implementation', page.implementation)}</strong></div>
    </div>
    <div class="detail-notes"><h3>특이사항</h3><ul>${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul></div>
    <p class="next-action"><strong>다음 조치</strong><br>${escapeHtml(page.action || '현재 상태 유지')}</p>`;
}

function readFilters(form) {
  const data = new FormData(form);
  return {
    query: String(data.get('query') ?? ''),
    area: String(data.get('area') ?? 'all'),
    stage: String(data.get('stage') ?? 'all'),
    planning: String(data.get('planning') ?? 'all'),
    design: String(data.get('design') ?? 'all'),
    api: String(data.get('api') ?? 'all'),
    sort: String(data.get('sort') ?? 'risk_desc'),
  };
}

async function initialize() {
  const response = await fetch(dashboardDataUrl(), { cache: 'no-store' });
  if (!response.ok) throw new Error(`데이터 요청 실패 (${response.status})`);
  const snapshot = await response.json();
  if (snapshot.schemaVersion !== 1) throw new Error('지원하지 않는 데이터 버전입니다.');

  const form = document.querySelector('#filters');
  const rows = document.querySelector('#page-rows');
  const emptyState = document.querySelector('#empty-state');
  const resultCount = document.querySelector('#result-count');
  const dialog = document.querySelector('#page-dialog');

  document.querySelector('#summary-cards').innerHTML = summaryCards(snapshot.summary);
  document.querySelector('#review-scope').textContent = `검토 ${snapshot.summary.reviewedPages}/${snapshot.summary.totalPages} 페이지 · 요구사항 ${snapshot.summary.matchedItems}/${snapshot.summary.totalItems} 일치`;
  document.querySelector('#freshness-label').textContent = '최신 데이터';
  document.querySelector('#generated-at').textContent = new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(snapshot.generatedAt));

  if (snapshot.diagnostics.length > 0) {
    document.querySelector('#diagnostics').hidden = false;
    document.querySelector('#diagnostics-list').innerHTML = snapshot.diagnostics
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join('');
  }

  function render() {
    const filters = readFilters(form);
    const visible = sortPages(filterPages(snapshot.pages, filters), filters.sort);
    rows.innerHTML = visible.map(pageRow).join('');
    emptyState.hidden = visible.length !== 0;
    resultCount.textContent = `${visible.length} / ${snapshot.pages.length} 페이지`;
  }

  form.addEventListener('input', render);
  form.addEventListener('change', render);
  rows.addEventListener('click', (event) => {
    const button = event.target.closest('[data-page-id]');
    if (!button) return;
    const page = snapshot.pages.find(({ id }) => id === button.dataset.pageId);
    if (!page) return;
    document.querySelector('#dialog-area').textContent = AREA_LABELS[page.area] ?? page.area;
    document.querySelector('#dialog-title').textContent = page.name;
    document.querySelector('#dialog-body').innerHTML = detailMarkup(page);
    dialog.showModal();
  });
  document.querySelector('#dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  render();
}

if (typeof document !== 'undefined') {
  initialize().catch((error) => {
    document.querySelector('#freshness-label').textContent = '데이터 로드 실패';
    document.querySelector('#generated-at').textContent = error instanceof Error ? error.message : String(error);
  });
}

globalThis.ProgressDashboard = {
  formatProgress,
  filterPages,
  sortPages,
  stageLabel,
  axisLabel,
  dashboardDataUrl,
};
