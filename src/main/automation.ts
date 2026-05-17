import { BrowserWindow } from 'electron';
import { focusWindow } from './window-focus';
import { isResultsScreen, isPopupVisible } from './screen-detect';

export interface AutomationConfig {
  windowTitle: string;
  sKeyIntervalMs: number;   // how often to press S during a match
  preStartDelayMs: number;  // wait before pressing Space to start
  matchesPerCycle: number;  // popup appears every N matches
}

export const DEFAULT_CONFIG: AutomationConfig = {
  windowTitle: 'FC 온라인',
  sKeyIntervalMs: 3000,
  preStartDelayMs: 3000,
  matchesPerCycle: 20,
};

type State = 'IDLE' | 'LOBBY' | 'MATCH_IN_PROGRESS' | 'RESULTS' | 'POPUP';

let running = false;
let matchCount = 0;
let currentState: State = 'IDLE';

function emit(win: BrowserWindow, channel: string, payload: unknown) {
  if (!win.isDestroyed()) {
    win.webContents.send(channel, payload);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendKey(key: string, config: AutomationConfig) {
  focusWindow(config.windowTitle);
  if (process.platform !== 'win32') {
    // Dev mode on macOS — just log
    console.log(`[automation] sendKey: ${key}`);
    return;
  }
  // Use nut-js keyboard on Windows
  const { keyboard, Key } = await import('@nut-tree-fork/nut-js');
  const keyMap: Record<string, unknown> = {
    Space: Key.Space,
    S: Key.S,
    Escape: Key.Escape,
  };
  const mapped = keyMap[key];
  if (!mapped) {
    console.warn(`[automation] Unknown key: ${key}`);
    return;
  }
  await keyboard.pressKey(mapped as never);
  await keyboard.releaseKey(mapped as never);
}

export async function startAutomation(win: BrowserWindow, config: AutomationConfig) {
  if (running) return;
  running = true;
  matchCount = 0;

  const setStatus = (status: string) => {
    console.log(`[automation] ${status}`);
    emit(win, 'automation:status', { status });
  };

  try {
    while (running) {
      // ── LOBBY: start a match ──
      currentState = 'LOBBY';
      setStatus(`대기 중... (${config.preStartDelayMs / 1000}초 후 경기 시작)`);
      await sleep(config.preStartDelayMs);
      if (!running) break;

      setStatus(`경기 시작 중 (#${matchCount + 1})`);
      await sendKey('Space', config);

      // ── MATCH_IN_PROGRESS: press S repeatedly until results screen ──
      currentState = 'MATCH_IN_PROGRESS';
      setStatus(`경기 진행 중 (#${matchCount + 1}) — S키 스킵 중`);

      while (running) {
        await sleep(config.sKeyIntervalMs);
        if (!running) break;

        const resultsVisible = await isResultsScreen();
        if (resultsVisible) {
          currentState = 'RESULTS';
          break;
        }

        await sendKey('S', config);
      }

      if (!running) break;

      // ── RESULTS: advance past results screen ──
      matchCount += 1;
      emit(win, 'automation:count', { count: matchCount });
      setStatus(`결과 화면 확인 (#${matchCount}) — Space 입력`);
      await sendKey('Space', config);
      await sleep(1000);

      // ── POPUP: dismiss reward warning every N matches ──
      if (matchCount % config.matchesPerCycle === 0) {
        currentState = 'POPUP';
        setStatus(`팝업 대기 중 (#${matchCount})`);
        await sleep(1500);
        const popupVisible = await isPopupVisible();
        if (popupVisible) {
          setStatus('보상 불가 팝업 닫는 중 (ESC)');
          await sendKey('Escape', config);
          await sleep(500);
        } else {
          // Popup didn't appear — press ESC anyway as a safety measure
          console.log('[automation] Popup not detected visually, sending ESC as fallback');
          await sendKey('Escape', config);
        }
      }
    }
  } catch (err) {
    emit(win, 'automation:error', { message: String(err) });
  } finally {
    running = false;
    currentState = 'IDLE';
    emit(win, 'automation:status', { status: '정지됨' });
    emit(win, 'automation:stopped', {});
  }
}

export function stopAutomation() {
  running = false;
}

export function getState() {
  return { running, matchCount, currentState };
}
