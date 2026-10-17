# Architecture

## 프로젝트 구조

```text
Markdown/
├── core/                           # 앱 전체가 공통으로 쓰는 파일 (여러 기능이 import)
│   ├── api.js                      # pywebview API 준비 대기 및 호출 헬퍼(withApi), 여러 모듈이 공통 사용
│   ├── base.css                    # :root 색상/크기/글꼴/줄간격 변수, html·body 기본 스타일, 글자 선택(::selection) 색 (색/크기 변수는 여기서 공통 관리)
│   ├── config.js                   # 에디터/Markdown/UI/표/파일/탭/대화상자/링크/이미지 관련 전역 설정
│   ├── context-menu.css            # 우클릭 메뉴 공통 스타일 (기본/표/이미지/링크 메뉴)
│   ├── context-menu.js             # 우클릭 메뉴 공통 동작: 표시/숨김/위치 보정/바깥 클릭·ESC로 닫기/버튼 연결
│   ├── dialog.css                  # 링크/이미지 입력 대화상자, 저장 확인 대화상자, 공용 버튼 영역
│   ├── doc-context.js              # 활성 문서의 경로·기준 폴더 URL 관리 및 상대/Windows 이미지 경로 변환
│   ├── editor-content.css          # 에디터 안 Markdown 요소 스타일: 제목, 문단, 코드, 인용문, 목록, 구분선, 굵게/기울임
│   ├── editor.js                   # 앱 진입점. Tiptap 에디터 생성 및 확장 등록; 표 열 너비 보정, 이미지 로드 대체 처리, 에디터 생성 시 끝 문단 보장 등 초기 설정
│   ├── layout.css                  # 상태 바, 에디터 영역(#editor-wrap, #editor) 배치와 스크롤바
│   ├── markdown.js                 # Markdown 텍스트와 Tiptap 문서 구조 간 변환; 저장 시 문서 구조를 Markdown으로 직접 직렬화
│   ├── plain-text.js               # .txt 저장용: Tiptap 문서 구조를 Markdown 기호 없는 순수 텍스트로 변환
│   ├── shortcuts.js                # 전역 단축키: 저장/열기/새 창/새 탭/탭 닫기/탭 전환/찾기
│   └── vendor.js                   # Tiptap/ProseMirror 및 관련 라이브러리의 번들/재export 모듈
├── features/                       # 기능별 폴더. 기능마다 해당 js/css를 함께 둠
│   ├── app-menu/                   # 기본 우클릭 메뉴
│   │   └── app-menu.js             # 기본 우클릭 컨텍스트 메뉴: 새 파일, 열기, 저장, 다른 이름으로 저장, 표/링크/이미지 삽입
│   ├── click-anywhere/
│   │   └── click-anywhere.js
│   ├── code-copy/                  # 코드박스 복사
│   │   ├── code-copy.css           # 복사 버튼 스타일
│   │   └── code-copy.js            # 코드박스에 마우스를 올리면 복사 버튼 표시, 클릭 시 코드 내용을 클립보드에 복사
│   ├── dialogs/
│   │   ├── confirm-dialog.js       # 저장하지 않은 탭을 닫을 때 뜨는 저장/저장 안 함/취소 확인 대화상자
│   │   └── insert-dialog.js        # 링크/이미지 입력 대화상자; URL 검증, 선택 복원, 이미지 파일 선택 및 링크 제거 지원
│   ├── file/                       # 파일 열기/저장
│   │   └── file-io.js              # pywebview API를 통한 파일 열기/저장 및 상태 메시지 처리; 저장 시 Markdown과 순수 텍스트를 함께 전달하고 파일 동작을 탭 관리와 연결
│   ├── find/                       # 찾기
│   │   ├── find-bar.css            # 찾기(Ctrl+F) 바와 검색 결과 하이라이트
│   │   └── find-bar.js             # 찾기 Ctrl+F 바
│   ├── formatting/                 # 서식
│   │   ├── bubble-menu.css         # 텍스트 선택 시 나타나는 버블 서식 툴바 (표 변환 버튼 포함)
│   │   ├── bubble-menu.js          # 텍스트 선택 시 나타나는 플로팅(버블) 서식 툴바 및 선택 상태/위치 제어
│   │   └── formatting.js           # 헤딩/인용구/목록 토글 및 버블 메뉴 서식 명령 처리
│   ├── image/                      # 이미지
│   │   ├── image-fallback.js       # 이미지 로드 실패 시 Python 로컬 이미지 서버의 URL을 조회해 표시 주소를 대체하며, 같은 이미지의 반복 실패 처리를 방지
│   │   ├── image-menu.js           # 이미지 우클릭 메뉴
│   │   ├── image-view.js           # 이미지 NodeView와 오른쪽 아래 모서리 리사이즈; 너비를 문서의 width 속성 및 Markdown 이미지 태그에 저장하고 원래 크기로 복원
│   │   └── image.css               # 이미지 표시와 크기 조절 핸들
│   ├── link/                       # 링크
│   │   ├── link-click.js           # Ctrl/Cmd+클릭 시 링크를 시스템 기본 브라우저로 열기
│   │   └── link-menu.js            # 링크 우클릭 메뉴
│   ├── list-behavior/              # 리스트 편집 동작 보정
│   │   ├── no-list-nesting.js      # 리스트 항목 안에서 "- " 등을 입력해도 리스트가 겹쳐 만들어지지 않게 막는 입력 처리
│   │   └── no-list-rejoin.js       # 리스트 항목/리스트·인용문 바로 뒤 문단에서 Backspace 시 구조가 합쳐지거나 늘어나는 현상을 방지하는 custom Extension
│   ├── table/                      # 표
│   │   ├── table-actions.js        # 표 삽입, 마크다운 표 텍스트 변환, 표 행/열/헤더/삭제 명령
│   │   ├── table-menu.js           # 표 셀 우클릭 컨텍스트 메뉴: 헤더 토글, 행/열 추가·삭제, 표 삭제
│   │   └── table.css               # 표, 셀 선택, 열 크기 조절 핸들
│   ├── tabs/                       # 문서 탭
│   │   ├── tab-bar.css             # 탭 바, 탭, 닫기 버튼
│   │   ├── tab-bar.js              # 탭 바 화면 표시 및 드래그로 탭 순서 변경
│   │   └── tabs.js                 # 문서 탭 목록/전환/닫기 관리, 탭별 에디터 상태(실행 취소 포함) 보관
│   └── welcome/                    # 시작 안내문
│       ├── welcome-content.js      # 새 문서에 표시되는 시작 안내 콘텐츠(마크다운 문법 및 단축키 설명) HTML. features/welcome/welcome.js가 import
│       ├── welcome.css             # 안내문 위치와 회색 반투명 스타일
│       └── welcome.js              # 앱을 처음 켰을 때만 빈 에디터 위에 회색 안내문을 겹쳐 표시, 내용이 바뀌거나 탭이 바뀌면 영구히 숨김
├── index.html                      # 에디터 UI 레이아웃, 탭 바, 버블 메뉴/우클릭 메뉴/표 메뉴/입력·확인 대화상자 DOM 구조, core/·features/ 아래 css 파일 11개 연결, 진입점은 core/editor.js
└── main.py                         # pywebview 기반 데스크톱 GUI 실행, 경로 기반 File I/O/이미지 API 제공, 새 창 실행, 창 닫기 가로채기, .md/.txt 저장 지원 (.txt는 순수 글자로 저장)
```

## 폴더 규칙

- **core/**: 둘 이상의 기능이 함께 쓰는 파일, 앱 전체 설정, 진입점을 둡니다.
- **features/기능이름/**: 한 기능에만 속한 js/css를 함께 둡니다.
- 새 기능은 `features/기능이름/` 폴더를 만들고, 그 기능의 js/css를 안에 넣습니다.
- 한 기능이 여러 기능에서 쓰이게 되면 `core/`로 옮깁니다.

## index.html CSS 연결

| 경로 | 설명 |
| --- | --- |
| `core/base.css` | 공통 변수와 기본 스타일 |
| `core/layout.css` | 레이아웃 |
| `core/editor-content.css` | 에디터 내용 스타일 |
| `core/context-menu.css` | 우클릭 메뉴 공통 스타일 |
| `core/dialog.css` | 대화상자 공통 스타일 |
| `features/find/find-bar.css` | 찾기 바 |
| `features/formatting/bubble-menu.css` | 버블 서식 툴바 |
| `features/table/table.css` | 표 |
| `features/image/image.css` | 이미지 |
| `features/tabs/tab-bar.css` | 탭 바 |
| `features/code-copy/code-copy.css` | 코드박스 복사 버튼 |
| `features/welcome/welcome.css` | 시작 안내문 |
