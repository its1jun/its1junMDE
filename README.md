# its1junMDE

## 프로젝트 개요

- **앱 이름:** its1junMDE
- **종류:** Python 기반 데스크톱 Markdown 편집기
- **데스크톱 창 및 OS 연동:** Python + pywebview
- **사용자 인터페이스:** HTML, CSS, JavaScript
- **문서 편집 엔진:** Tiptap / ProseMirror
- **문서 형식:** Markdown (`.md`), 일반 텍스트 (`.txt`)
- **실행 진입점:** `main.py`
- **UI 진입점:** `index.html` → `core/editor.js`

## 기술 구조

```text
┌─────────────────────────────────────┐
│ Python: main.py                     │
│ 데스크톱 창, 파일 시스템, OS 연동   │
└──────────────────┬──────────────────┘
                   │ pywebview JS API
┌──────────────────▼──────────────────┐
│ pywebview                            │
│ Python과 웹 UI를 연결                │
└──────────────────┬──────────────────┘
                   │
┌──────────────────▼──────────────────┐
│ HTML / CSS / JavaScript              │
│ 화면, 메뉴, 탭, 기능별 동작          │
├─────────────────────────────────────┤
│ Tiptap / ProseMirror                 │
│ 문서 구조 및 리치 텍스트 편집        │
└─────────────────────────────────────┘
```

### 각 기술의 역할

| 기술 | 역할 |
| --- | --- |
| **Python (**`main.py`**)** | pywebview 창을 실행하고 파일 열기·저장 대화상자, 파일 읽기·쓰기, 외부 링크 열기, 로컬 이미지 제공, 새 창 및 창 닫기 절차를 처리합니다. |
| **pywebview** | 웹 기반 UI를 데스크톱 창에 표시하고 JavaScript에서 Python API를 호출할 수 있게 연결합니다. |
| **Tiptap / ProseMirror** | 편집 중인 문서의 구조와 편집 동작을 관리합니다. 에디터 초기화와 확장 등록은 core/editor.js에서 수행합니다. |
| **JavaScript 기능 모듈** | 탭, 파일 I/O 연결, 서식 툴바, 표, 이미지, 링크, 찾기 등 기능별 동작을 구현합니다. |
| **CSS** | 공통 UI와 에디터 및 각 기능의 표시 방식을 담당합니다. |
| **Markdown 변환** | core/markdown.js가 Markdown과 에디터 문서 구조 사이의 변환 및 저장용 직렬화를 담당합니다. .txt 저장용 순수 텍스트 변환은 core/plain-text.js에 있습니다. |

## 준비 사항

| 항목 | Windows | Ubuntu Linux |
| --- | --- | --- |
| Python | Python 설치 | Python 설치 |
| pywebview | pywebview 설치 | GTK 또는 Qt 백엔드 선택 |
| 브라우저 엔진 | WebView2 Runtime 등 환경 확인 | WebKit2 또는 Qt WebEngine 등 확인 |
| 시스템 의존성 | 선택한 백엔드에 따라 확인 | 선택한 백엔드에 필요한 시스템 패키지 설치 |
| 프로젝트 추가 패키지 | 실제 main.py의 import 확인 | 실제 main.py의 import 확인 |

## 문서 안내

| 문서 | 목적 |
| --- | --- |
| `README.md` | 프로젝트 소개, 기술 구성, 실행 방법, 작업 재개 안내 |
| `ARCHITECTURE.md` | 실제 디렉터리 트리, 파일별 역할, 폴더 규칙, CSS 연결 정보 |
