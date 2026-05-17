# FC Online Bot

FC Online 감독모드 연속모드 자동화 툴 (Electron + nut-js)

## 동작 방식

화면 템플릿 매칭으로 게임 상태를 감지해 키보드를 자동 입력합니다.

```
LOBBY ──[Space]──► 경기 진행 중 ──[결과 화면 감지]──► RESULTS
                       │                                   │
                   [S키 반복]                          [Space]
                                                           │
                                           matchCount % 20 == 0?
                                           YES → POPUP ──[ESC]──► LOBBY
                                           NO  ─────────────────► LOBBY
```

### 키 매핑
| 키 | 역할 |
|---|---|
| `Space` | 경기 시작 / 결과 화면 넘기기 |
| `S` | 경기 중 리플레이/컷씬 스킵 (3초마다) |
| `ESC` | 20판마다 뜨는 보상 불가 팝업 닫기 |

## 시작하기

```bash
npm install
npm run dev
```

## 첫 실행 시 필수 작업 — 레퍼런스 이미지 설정

앱의 **"화면 설정" 탭**에서 두 가지 이미지를 등록해야 화면 인식이 동작합니다.

1. **결과 화면** — 경기 종료 후 결과 UI가 뜬 상태에서 캡처
2. **보상 불가 팝업** — 20판 후 뜨는 팝업이 있는 상태에서 캡처

캡처 방법: 해당 화면을 띄운 뒤 "📷 스크린샷" → 드래그로 영역 선택 → 저장

저장된 이미지는 `assets/` 폴더에 저장되며 gitignore 처리되어 있습니다.

## 빌드 (Windows 인스톨러)

```bash
npm run build
# dist-package/ 에 .exe 인스톨러 생성
```

## 프로젝트 구조

```
src/
├── main/
│   ├── index.ts          # Electron 메인 프로세스, IPC
│   ├── automation.ts     # 상태머신 자동화 루프
│   ├── screen-detect.ts  # nut-js 템플릿 매칭
│   ├── preload.ts        # 렌더러 ↔ 메인 브리지
│   └── window-focus.ts   # Win32 창 포커스 (macOS에서는 no-op)
└── renderer/
    ├── index.html        # UI
    └── renderer.ts       # 렌더러 로직
```

## 미완료 사항

- [ ] TypeScript 컴파일 오류 수정 (`screen-detect.ts` — nut-js capture API 확인 필요)
- [ ] Windows에서 실제 FC Online 창 제목 확인 후 `windowTitle` 기본값 조정
- [ ] `assets/` 폴더에 더미 `icon.png` 추가 (electron-builder 필요)
