// NUL-terminated Johab strings from the bundled H.EXE. Spaces position the bitmap text.
export const originalText = {
  "about": [
    " 하늘은 누구나 자유롭게 사용할 수 있는",
    "공개 풀그림입니다. 하늘소의 허락 없이는",
    " 상업적인 목적으로 이용할 수 없습니다.",
    "       더 밝은 미래를 위하여...",
    "     4325년 8월에          하늘소"
  ],
  "aboutTitle": "   하늘 그림틀  둘째 마당 세째 고개    ",
  "help": [
    " 도움말(F1) : 현재 작업 중인 일의 상세한 도움말 보기",
    "  ESC, F10  : 차림표 부르기",
    "  @, ^ 표시 : @은 알트(ALT) 글쇠와 동시에 누르라는 뜻",
    "              ^은 콘트롤(CTRL) 글쇠와 동시에 누르라는 뜻",
    "  기능 이동 : 마우스 움직임, 키보드의 화살표 조작",
    "  기능 실행 : 마우스의 왼쪽 버턴, 키보드의 리턴(Return) 글쇠",
    "  범위 설정 : 마우스의 오른쪽 버턴을 누른체 마우스 이동",
    "아이콘 기능 : 아이콘이 위치한 자리에 가서 마우스의 왼쪽 버턴을",
    "              누름"
  ],
  "helpTitle": "                하늘 그림틀의 간단한 도움말                 ",
  "helpMemory": "            남은 기억 용량은 %03dK 바이트입니다                ",
  "soundOff": "모든 음향 효과가 꺼졌읍니다.!!",
  "soundOn": "이제 음향 효과가 켜졌읍니다.!!"
};

// Printer selection and status tables at H.EXE 0x1b542..0x1b7f5.
export const printerText = {
  "models": [
    "  8핀 프린터 (80) ",
    "  8핀 프린터(132) ",
    " 24핀 프린터 (80) ",
    " 24핀 프린터(132) ",
    " 레이저 프린터    "
  ],
  "dot8": [
    " 8핀 240 DPI ",
    " 8핀 120 DPI ",
    " 8핀 120 (2) ",
    " 8핀 90  DPI ",
    " 8핀 80  DPI ",
    " 8핀 72  DPI ",
    " 8핀 60  DPI "
  ],
  "dot24": [
    " 24핀 360 DPI ",
    " 24핀 180 DPI ",
    " 24핀 120 DPI ",
    " 24핀 90  DPI ",
    " 24핀 60  DPI "
  ],
  "methods": [
    " 디터링 방식 ",
    " 패턴   방식 "
  ],
  "laser": [
    " 레이져 300 DPI ",
    " 레이져 150 DPI ",
    " 레이져 100 DPI ",
    " 레이져 75  DPI "
  ],
  "modelStatus": [
    " 8핀 프린터(80)",
    " 8핀 프린터(132)",
    "24핀 프린터(80)",
    "24핀 프린터(132)",
    "레이저 프린터"
  ],
  "methodStatus": [
    "디터링 방식",
    "패턴 방식"
  ],
  "sizes8": [
    "240 DPI",
    "120(1) DPI",
    "120(2) DPI",
    " 90 DPI",
    " 80 DPI",
    " 72 DPI",
    " 60 DPI"
  ],
  "sizes24": [
    "360 DPI",
    "180 DPI",
    "120 DPI",
    " 90DPI",
    " 60DPI"
  ],
  "sizesLaser": [
    "300 DPI",
    "150 DPI",
    "100 DPI",
    " 75 DPI"
  ],
  "panel": [
    "     프린터 환경 설정 상태    ",
    "프린터 종류",
    "프린터 방법",
    " 인쇄  크기",
    "    인쇄     ",
    "    취소    "
  ]
};
