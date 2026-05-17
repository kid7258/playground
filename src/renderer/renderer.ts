declare const window: Window & {
  fcBot: {
    start: (config: Record<string, unknown>) => Promise<void>;
    stop: () => Promise<void>;
    getState: () => Promise<{ running: boolean; matchCount: number; currentState: string }>;
    onStatus: (cb: (d: { status: string }) => void) => void;
    onCount: (cb: (d: { count: number }) => void) => void;
    onError: (cb: (d: { message: string }) => void) => void;
    onStopped: (cb: () => void) => void;
    takeScreenshot: () => Promise<{ ok: boolean; png?: string; error?: string }>;
    saveRegion: (args: { filename: string; x: number; y: number; width: number; height: number }) => Promise<{ ok: boolean; error?: string }>;
    hasReference: (filename: string) => Promise<boolean>;
  };
};

// ── Tab switching ──
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    const target = (tab as HTMLElement).dataset.tab!;
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${target}`)!.classList.add('active');
  });
});

// ── Automation tab ──
const statusText = document.getElementById('statusText')!;
const matchCountEl = document.getElementById('matchCount')!;
const errorText = document.getElementById('errorText')!;
const btnStart = document.getElementById('btnStart') as HTMLButtonElement;
const btnStop = document.getElementById('btnStop') as HTMLButtonElement;
const sIntervalInput = document.getElementById('sInterval') as HTMLInputElement;
const preDelayInput = document.getElementById('preDelay') as HTMLInputElement;

function setRunning(running: boolean) {
  btnStart.disabled = running;
  btnStop.disabled = !running;
}

btnStart.addEventListener('click', async () => {
  errorText.textContent = '';
  setRunning(true);
  await window.fcBot.start({
    sKeyIntervalMs: parseInt(sIntervalInput.value, 10) * 1000,
    preStartDelayMs: parseInt(preDelayInput.value, 10) * 1000,
  });
});

btnStop.addEventListener('click', () => {
  window.fcBot.stop();
});

window.fcBot.onStatus(({ status }) => {
  statusText.textContent = status;
});

window.fcBot.onCount(({ count }) => {
  matchCountEl.textContent = String(count);
});

window.fcBot.onError(({ message }) => {
  errorText.textContent = `오류: ${message}`;
});

window.fcBot.onStopped(() => {
  setRunning(false);
  statusText.textContent = '정지됨';
});

// Restore state on load
window.fcBot.getState().then(({ running, matchCount, currentState }) => {
  setRunning(running);
  matchCountEl.textContent = String(matchCount);
  if (currentState !== 'IDLE') statusText.textContent = currentState;
});

// ── Capture tab ──
const capturePreview = document.getElementById('capturePreview')!;
const previewImg = document.getElementById('previewImg') as HTMLImageElement;
const previewPlaceholder = document.getElementById('previewPlaceholder')!;
const selectionRect = document.getElementById('selectionRect')!;
const btnCapture = document.getElementById('btnCapture') as HTMLButtonElement;
const btnSaveResults = document.getElementById('btnSaveResults') as HTMLButtonElement;
const btnSavePopup = document.getElementById('btnSavePopup') as HTMLButtonElement;
const refResults = document.getElementById('refResults')!;
const refPopup = document.getElementById('refPopup')!;

let screenshotBase64 = '';
// Selection state in image-coordinate space
let sel = { x: 0, y: 0, w: 0, h: 0 };
let dragging = false;
let dragStart = { x: 0, y: 0 };

function imgToPreviewScale(): { scaleX: number; scaleY: number; offsetX: number; offsetY: number } {
  const rect = capturePreview.getBoundingClientRect();
  const naturalW = previewImg.naturalWidth || 1;
  const naturalH = previewImg.naturalHeight || 1;
  const displayW = previewImg.clientWidth;
  const displayH = previewImg.clientHeight;
  const scaleX = naturalW / displayW;
  const scaleY = naturalH / displayH;
  const offsetX = (rect.width - displayW) / 2;
  const offsetY = (rect.height - displayH) / 2;
  return { scaleX, scaleY, offsetX, offsetY };
}

capturePreview.addEventListener('mousedown', (e) => {
  if (!screenshotBase64) return;
  dragging = true;
  const rect = capturePreview.getBoundingClientRect();
  dragStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  selectionRect.style.display = 'block';
});

capturePreview.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const rect = capturePreview.getBoundingClientRect();
  const curX = e.clientX - rect.left;
  const curY = e.clientY - rect.top;
  const left = Math.min(dragStart.x, curX);
  const top = Math.min(dragStart.y, curY);
  const width = Math.abs(curX - dragStart.x);
  const height = Math.abs(curY - dragStart.y);
  selectionRect.style.left = `${left}px`;
  selectionRect.style.top = `${top}px`;
  selectionRect.style.width = `${width}px`;
  selectionRect.style.height = `${height}px`;

  // Convert to image coordinates
  const { scaleX, scaleY, offsetX, offsetY } = imgToPreviewScale();
  sel = {
    x: Math.round((left - offsetX) * scaleX),
    y: Math.round((top - offsetY) * scaleY),
    w: Math.round(width * scaleX),
    h: Math.round(height * scaleY),
  };
});

capturePreview.addEventListener('mouseup', () => {
  dragging = false;
  if (sel.w > 10 && sel.h > 10) {
    btnSaveResults.disabled = false;
    btnSavePopup.disabled = false;
  }
});

btnCapture.addEventListener('click', async () => {
  btnCapture.disabled = true;
  btnCapture.textContent = '캡처 중...';
  const result = await window.fcBot.takeScreenshot();
  btnCapture.disabled = false;
  btnCapture.textContent = '📷 스크린샷';
  if (!result.ok || !result.png) {
    alert(`캡처 실패: ${result.error}`);
    return;
  }
  screenshotBase64 = result.png;
  previewImg.src = `data:image/png;base64,${screenshotBase64}`;
  previewImg.style.display = 'block';
  previewPlaceholder.style.display = 'none';
  selectionRect.style.display = 'none';
  sel = { x: 0, y: 0, w: 0, h: 0 };
  btnSaveResults.disabled = true;
  btnSavePopup.disabled = true;
});

async function saveSelection(filename: string, label: string, statusEl: HTMLElement) {
  if (sel.w <= 0 || sel.h <= 0) {
    alert('먼저 영역을 드래그로 선택하세요.');
    return;
  }
  const result = await window.fcBot.saveRegion({
    filename,
    x: sel.x,
    y: sel.y,
    width: sel.w,
    height: sel.h,
  });
  if (result.ok) {
    statusEl.textContent = `${label}: ✓ 저장됨`;
    statusEl.className = 'ref-status ok';
  } else {
    alert(`저장 실패: ${result.error}`);
  }
}

btnSaveResults.addEventListener('click', () =>
  saveSelection('results-screen.png', '결과 화면 이미지', refResults)
);
btnSavePopup.addEventListener('click', () =>
  saveSelection('reward-popup.png', '팝업 이미지', refPopup)
);

// Check reference image status on load
async function checkRefs() {
  const [hasResults, hasPopup] = await Promise.all([
    window.fcBot.hasReference('results-screen.png'),
    window.fcBot.hasReference('reward-popup.png'),
  ]);
  refResults.textContent = `결과 화면 이미지: ${hasResults ? '✓ 있음' : '✗ 없음 (설정 필요)'}`;
  refResults.className = `ref-status ${hasResults ? 'ok' : 'missing'}`;
  refPopup.textContent = `팝업 이미지: ${hasPopup ? '✓ 있음' : '✗ 없음 (설정 필요)'}`;
  refPopup.className = `ref-status ${hasPopup ? 'ok' : 'missing'}`;
}

checkRefs();
