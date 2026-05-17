import path from 'path';
import { app } from 'electron';

// Resolve asset path whether running in dev or packaged
function assetPath(filename: string): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'assets', filename);
  }
  return path.join(__dirname, '..', '..', 'assets', filename);
}

let nutScreen: typeof import('@nut-tree-fork/nut-js').screen | null = null;
let imageResource: typeof import('@nut-tree-fork/nut-js').imageResource | null = null;

async function getNut() {
  if (!nutScreen) {
    const nut = await import('@nut-tree-fork/nut-js');
    nutScreen = nut.screen;
    imageResource = nut.imageResource;
    nutScreen.config.confidence = 0.85;
    nutScreen.config.autoHighlight = false;
  }
  return { screen: nutScreen!, imageResource: imageResource! };
}

async function findImage(filename: string): Promise<boolean> {
  try {
    const { screen, imageResource: ir } = await getNut();
    await screen.find(ir(assetPath(filename)));
    return true;
  } catch {
    return false;
  }
}

export async function isResultsScreen(): Promise<boolean> {
  return findImage('results-screen.png');
}

export async function isPopupVisible(): Promise<boolean> {
  return findImage('reward-popup.png');
}

export async function hasReferenceImage(filename: string): Promise<boolean> {
  const fs = await import('fs');
  return fs.existsSync(assetPath(filename));
}

// Capture the current screen and return it as a PNG buffer (for the capture helper UI)
export async function captureScreen(): Promise<Buffer> {
  const { screen } = await getNut();
  const img = await screen.capture();
  // nut-js SixelImage → PNG conversion
  const data = await img.toRGB();
  // Build a minimal PNG using Electron's nativeImage for simplicity
  const { nativeImage } = await import('electron');
  const ni = nativeImage.createFromBuffer(Buffer.from(data.data), {
    width: data.width,
    height: data.height,
  });
  return ni.toPNG();
}

// Save a cropped region of the screen as a reference image
export async function saveCroppedReference(
  filename: string,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<void> {
  const png = await captureScreen();
  const { nativeImage } = await import('electron');
  const full = nativeImage.createFromBuffer(png);
  const cropped = full.crop({ x, y, width, height });
  const fs = await import('fs');
  const dest = assetPath(filename);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, cropped.toPNG());
}
