# Architecture

## 프로젝트 구조

```text
Markdown/
├── core/                           # 앱 공통 모듈, 전역 설정, 에디터 초기화
│   ├── api.js                      # pywebview API 준비 대기 및 호출 헬퍼(withApi)
│   ├── base.css                    # 공통 CSS 변수와 html·body 기본 스타일, 글자 선택(::selection) 스타일
│   ├── config.js                   # 에디터, Markdown 변환, UI, 표, 파일, 상태 메시지, 확대/축소 등의 전역 설정값
│   ├── context-menu.css            # 기본·표·이미지·링크 우클릭 메뉴의 공통 스타일
│   ├── context-menu.js             # 컨텍스트 메뉴 공통 동작: 표시/숨김, 위치 보정, 바깥 클릭·ESC 처리
│   ├── dialog.css                  # 링크/이미지 입력 및 탭 닫기 확인 대화상자 스타일
│   ├── doc-context.js              # 활성 문서의 경로와 기준 폴더 URL 관리, 상대/Windows 이미지 경로 변환
│   ├── editor-content.css          # 에디터 안 제목, 문단, 코드, 인용문, 목록, 구분선, 텍스트 서식 스타일
│   ├── editor-extensions.js        # Tiptap 사용자 확장: 끝 빈 문단 유지, 서식 탈출, 표 아래에서 표로 진입하는 키보드 동작
│   ├── editor.js                   # 앱 진입점. Tiptap 에디터 및 확장 등록, 기능 모듈 초기화와 pywebview 준비 처리
│   ├── layout.css                  # 상태 바, 에디터 영역 배치 및 스크롤바 스타일
│   ├── markdown.js                 # Markdown과 Tiptap 문서 구조 간 변환 및 Markdown 저장 직렬화
│   ├── plain-text.js               # .txt 저장용 순수 텍스트 변환
│   ├── shortcuts.js                # 전역 키보드 단축키: 저장/열기/새 창/탭/찾기 등
│   ├── status.js                   # 여러 기능이 공유하는 상태 메시지 표시 및 자동 숨김
│   └── vendor.js                   # Tiptap/ProseMirror 및 관련 라이브러리의 번들/re-export 모듈
├── features/                       # 기능별 모듈. 기능에 속한 JS와 CSS를 해당 폴더에 배치
│   ├── app-menu/
│   │   └── app-menu.js             # 기본 우클릭 메뉴: 새 파일, 열기, 저장, 다른 이름으로 저장, 표/링크/이미지 삽입
│   ├── click-anywhere/
│   │   └── click-anywhere.js       # 에디터 바깥 여백 클릭 시 가까운 텍스트 위치로 커서를 이동
│   ├── code-copy/                  # 코드 블록 복사
│   │   ├── code-copy.css           # 코드 복사 버튼 스타일
│   │   └── code-copy.js            # 코드 블록에 마우스를 올리면 복사 버튼을 표시하고 코드 내용을 클립보드에 복사
│   ├── dialogs/
│   │   ├── confirm-dialog.js       # 변경 사항이 있는 탭을 닫을 때 저장/버리기/취소 확인 처리
│   │   └── insert-dialog.js        # 링크/이미지 입력 대화상자, URL 검증, 선택 복원, 이미지 파일 선택 및 링크 제거
│   ├── file/                       # 파일 열기/저장
│   │   └── file-io.js              # pywebview API를 통한 파일 열기/저장 및 상태 메시지 처리, 탭 관리와 연결
│   ├── find/                       # 문서 찾기
│   │   ├── find-bar.css            # 찾기 바와 검색 결과 하이라이트 스타일
│   │   └── find-bar.js             # Ctrl+F 찾기 UI 및 에디터 검색 동작
│   ├── formatting/                 # 텍스트 서식
│   │   ├── bubble-menu.css         # 텍스트 선택 시 나타나는 버블 툴바 스타일
│   │   ├── bubble-menu.js          # 버블 서식 툴바 표시, 위치 및 선택 상태 제어
│   │   └── formatting.js           # 제목/인용구/목록 등 서식 명령 처리
│   ├── image/                      # 이미지 표시와 편집
│   │   ├── image.css               # 이미지 표시와 크기 조절 핸들 스타일
│   │   ├── image-fallback.js       # 이미지 로드 실패 시 Python 로컬 이미지 서버 주소를 조회해 표시 주소 대체
│   │   ├── image-menu.js           # 이미지 우클릭 메뉴 동작
│   │   └── image-view.js           # 이미지 NodeView와 크기 조절; 너비를 문서 및 Markdown 이미지에 반영
│   ├── link/                       # 링크 동작
│   │   ├── link-click.js            # Ctrl/Cmd+클릭한 링크를 시스템 기본 브라우저에서 열기
│   │   └── link-menu.js             # 링크 우클릭 메뉴의 편집/삭제 동작
│   ├── list-behavior/              # 리스트 편집 동작 보정
│   │   ├── no-list-nesting.js      # 리스트 항목 안에서 '- ' 등을 입력할 때 중첩 리스트가 생기는 동작 방지
│   │   └── no-list-rejoin.js       # Backspace로 리스트/인용문과 주변 문단 구조가 의도치 않게 합쳐지는 현상 방지
│   ├── table/                      # 표 기능
│   │   ├── table-actions.js        표 삽입, 마크다운 표 텍스트 변환, 표 행/열/헤더/삭제 명령 → 표 삽입, 마크다운 표 텍스트 ↔ 표 변환, 표 행/열/헤더/삭제 명령
│   │   ├── table-menu.js           #헤더 토글, 행/열 추가·삭제, 표 삭제 → 헤더 토글, 행/열 추가·삭제, 마크다운 글자로 변환, 표 삭제
│   │   └── table.css               # 표, 셀 선택 및 열 크기 조절 핸들 스타일
│   ├── tabs/                       # 문서 탭 관리
│   │   ├── tab-bar.css             # 탭 바, 탭 및 닫기 버튼 스타일
│   │   ├── tab-bar.js              # 탭 바 렌더링 및 드래그를 통한 탭 순서 변경
│   │   └── tabs.js                 # 탭 생성/전환/닫기, 탭별 에디터 상태 및 실행 취소 상태 관리
│   ├── welcome/                    # 시작 안내문
│   │   ├── welcome-content.js      # 새 문서에 표시할 Markdown 문법 및 단축키 안내 콘텐츠
│   │   ├── welcome.css             # 안내문 위치와 반투명 스타일
│   │   └── welcome.js              # 초기 빈 에디터 위에 안내문을 표시하고 편집/탭 변경 시 숨김
│   └── zoom/
│       └── zoom.js                 # Ctrl+휠로 에디터 글자 크기 확대/축소, Ctrl+0으로 초기 배율 복원
├── index.html                      # 에디터 UI 및 탭 바, 상태 바, 찾기 바, 버블 메뉴, 컨텍스트 메뉴와 대화상자 DOM; CSS 12개 연결
└── main.py                         # pywebview 데스크톱 GUI와 파일 시스템 API, 로컬 이미지 서버, 새 창 및 창 닫기 처리, .md/.txt 저장 지원
```

## 폴더 규칙

- `core/`: 여러 기능이 공유하는 코드, 전역 설정, 에디터 초기화 및 공통 기반 기능을 둡니다.
- `features/기능이름/`: 특정 기능에 속한 JS와 CSS를 기능별 폴더에 함께 둡니다.
- 새 기능은 원칙적으로 `features/기능이름/` 폴더를 만들고 관련 JS/CSS를 그 안에 둡니다.
- 여러 기능에서 공통으로 사용하는 코드가 생기면 역할을 검토한 뒤 `core/`로 이동합니다.
- `index.html`에 연결하는 CSS와 JavaScript의 실제 경로가 프로젝트 구조와 일치하도록 유지합니다.

## `index.html` CSS 연결

아래 목록은 ZIP 안의 `index.html`에 실제로 연결된 스타일시트 기준입니다.

| 경로 | 설명 |
| --- | --- |
| `core/base.css` | 공통 변수와 기본 스타일 |
| `core/context-menu.css` | 우클릭 메뉴 공통 스타일 |
| `core/dialog.css` | 대화상자 스타일 |
| `core/editor-content.css` | 에디터 내용 스타일 |
| `core/layout.css` | 상태 바 및 에디터 레이아웃 |
| `features/code-copy/code-copy.css` | 코드 블록 복사 버튼 |
| `features/find/find-bar.css` | 찾기 바와 검색 결과 하이라이트 |
| `features/formatting/bubble-menu.css` | 버블 서식 툴바 |
| `features/image/image.css` | 이미지 및 크기 조절 핸들 |
| `features/table/table.css` | 표 및 열 크기 조절 |
| `features/tabs/tab-bar.css` | 문서 탭 바 |
| `features/welcome/welcome.css` | 시작 안내문 |
