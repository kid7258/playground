// Win32 window focus via ffi-napi. All calls are gated on process.platform === 'win32'
// so this module is safe to import on macOS during development — it simply no-ops.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let user32: any = null;

function loadUser32() {
  if (process.platform !== 'win32') return null;
  if (user32) return user32;
  // Dynamic require — ffi-napi is an optionalDependency, present only on Windows builds
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ffi = require('ffi-napi');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ref = require('ref-napi');
  user32 = ffi.Library('user32', {
    FindWindowW: [ref.types.void_p, ['void *', 'string']],
    SetForegroundWindow: ['bool', [ref.types.void_p]],
    ShowWindow: ['bool', [ref.types.void_p, 'int']],
  });
  return user32;
}

export function focusWindow(title: string): boolean {
  const lib = loadUser32();
  if (!lib) {
    // macOS dev mode — no-op
    return true;
  }
  const hwnd = lib.FindWindowW(null, title);
  if (!hwnd || hwnd.isNull?.()) {
    console.warn(`[window-focus] Window not found: "${title}"`);
    return false;
  }
  lib.ShowWindow(hwnd, 9); // SW_RESTORE
  return lib.SetForegroundWindow(hwnd);
}
