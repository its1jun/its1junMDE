// 프로젝트 전역 하드코딩 상수 모음.
// 값을 바꾸고 싶을 때는 이 파일만 수정하면 됩니다.
import { WELCOME_CONTENT } from './welcome-content.js'
export const EDITOR_CONFIG = {
  // 에디터가 마운트될 요소의 셀렉터
  selector: '#editor',
  // 에디터 시작 시 표시되는 기본 HTML: 맨 위 제목 아래에 마크다운 문법과 단축키 설명을 순서대로 둡니다.
  // 템플릿 문자열(백틱) 안이라 문법 예시의 백틱과 > 는 HTML 엔티티(&#96; &gt;)로 적습니다.
  initialContent: WELCOME_CONTENT,
  // '새 파일' 클릭 시 채워지는 빈 문서
  emptyContent: '<p></p>',
}

export const MARKDOWN_CONFIG = {
  heading: '#',
  bold: '**',
  italic: '*',
  strike: '~~',
  code: '`',
  linkOpen: '[',
  linkMid: '](',
  linkClose: ')',
  imagePrefix: '!',
  quote: '> ',
  bullet: '- ',
  orderedSuffix: '. ',       // 번호 접두사: `${번호}${orderedSuffix}` (예: "1. ")
  hr: '---',
  codeFence: '```',
  hardBreak: '  \n',
  tablePipe: '|',
  tableCellPad: ' ',
  tableDivider: '---',
  blockSeparator: '\n\n',
  lineSeparator: '\n',
}

export const UI_CONFIG = {
  // 버블 메뉴와 화면 가장자리 사이 최소 여백(px), CSS의 translate 간격(8px)과 동일하게 유지
  bubbleMargin: 8,
  bubbleMenuId: 'bubble-menu',
  tabBarId: 'tab-bar',
  statusId: 'status',
  bubbleButtons: {
    bold: 'bb-bold',
    italic: 'bb-italic',
    strike: 'bb-strike',
    code: 'bb-code',
    h1: 'bb-h1',
    h2: 'bb-h2',
    h3: 'bb-h3',
    quote: 'bb-quote',
    bullet: 'bb-bullet',
    ordered: 'bb-ordered',
    convertTable: 'bb-tbl-convert',
  },
  // 표 우클릭 컨텍스트 메뉴 버튼 ID
  tableMenuButtons: {
    toggleHeader: 'tm-header',
    insertRow: 'tm-row-insert',
    insertCol: 'tm-col-insert',
    deleteRow: 'tm-row-del',
    deleteCol: 'tm-col-del',
    deleteTable: 'tm-tbl-del',
  },
  // 기본 우클릭 메뉴 요소 및 버튼 ID
  appMenuId: 'app-context-menu',
  appMenuButtons: {
    new: 'am-new',
    open: 'am-open',
    save: 'am-save',
    saveAs: 'am-save-as',
    insertTable: 'am-insert-table',
    insertLink: 'am-insert-link',
    insertImage: 'am-insert-image',
  },
  // 링크/이미지 입력 대화상자 요소 ID
  dialog: {
    backdropId: 'insert-dialog-backdrop',
    titleId: 'dlg-title',
    textRowId: 'dlg-text-row',
    textInputId: 'dlg-text',
    urlInputId: 'dlg-url',
    altRowId: 'dlg-alt-row',
    altInputId: 'dlg-alt',
    okId: 'dlg-ok',
    cancelId: 'dlg-cancel',
    removeId: 'dlg-remove',
    browseId: 'dlg-browse',
  },
  // 탭 닫기 시 저장 여부를 묻는 확인 대화상자 요소 ID
  confirmDialog: {
    backdropId: 'confirm-dialog-backdrop',
    messageId: 'confirm-message',
    saveId: 'confirm-save',
    discardId: 'confirm-discard',
    cancelId: 'confirm-cancel',
  },
  // 표 우클릭 컨텍스트 메뉴 요소 ID
  tableMenuId: 'table-context-menu',
  // 이미지 우클릭 컨텍스트 메뉴 요소 ID
  imageMenuId: 'image-context-menu',
  imageMenuButtons: {
    deleteImage: 'im-delete',
  },
  // 링크 우클릭 컨텍스트 메뉴 요소 ID
  linkMenuId: 'link-context-menu',
  linkMenuButtons: {
    editLink: 'lm-edit',
    deleteLink: 'lm-delete',
  },
  // 찾기(Ctrl+F) 바 요소 ID
  findBar: {
    barId: 'find-bar',
    inputId: 'find-input',
    countId: 'find-count',
  },
  // 표 변환 버튼 그룹 ID (마크다운 표 선택 시에만 표시)
  convertGroupId: 'bb-convert-group',
  // 활성 상태 표시용 클래스명
  classes: {
    visible: 'visible',
    active: 'active',
    dirty: 'dirty',
  },
}
// 표 삽입 기본값
export const TABLE_CONFIG = {
  // 마크다운 표 구분선 판별 정규식 (예: | --- | :---: |)
  dividerPattern: '^\\s*\\|?\\s*:?-{1,}:?\\s*(\\|\\s*:?-{1,}:?\\s*)*\\|?\\s*$',
  // 빈 셀에 넣을 내용 (Tiptap은 자식이 전혀 없는 셀을 거부하므로 빈 문단으로 채움)
  emptyCellHtml: '<p></p>',
  rows: 3,
  cols: 3,
  withHeaderRow: true,
  resizable: true,
  colwidthFillDebounceMs: 150, // 표 폭 자동 계산 디바운스 시간(ms)
}

// 저장 대화상자의 기본 파일명/확장자/파일 형식은 Python(main.py)이 단독으로 관리합니다.
export const FILE_CONFIG = {
  defaultTitle: 'Untitled',  // 저장 전 문서의 탭 이름
  statusDuration: 2000,      // 상태 메시지 노출 시간(ms)
}

export const MESSAGES_CONFIG = {
  opening: 'Opening...',
  opened: 'Opened: ',
  openFailed: 'Open failed: ',
  saving: 'Saving...',
  saved: 'Saved: ',
  saveFailed: 'Save failed: ',
}

export const DIALOG_CONFIG = {
  linkTitle: 'Insert Link',
  editLinkTitle: 'Edit Link',
  imageTitle: 'Insert Image',
  // 허용하지 않을 URL 스킴 (스크립트 실행 방지)
  blockedUrlPattern: '^\\s*(javascript|vbscript):',
}

export const LINK_CONFIG = {
  openHint: 'Ctrl+Click to open link',
}

export const FIND_CONFIG = {
  matchClass: 'find-match',
  activeClass: 'find-match-active',
  noResultsLabel: '0/0',
}

export const IMAGE_CONFIG = {
  minWidth: 32,                          // 드래그로 줄일 수 있는 최소 너비(px)
  handles: ['se'],                       // 크기 조절 핸들 위치 (오른쪽 아래 모서리 1곳)
  classes: {
    wrap: 'img-wrap',
    selected: 'selected',
    resizing: 'resizing',
    handle: 'img-handle',
  },
}

export const TAB_CONFIG = {
  classes: {
    tab: 'tab',
    active: 'active',
    dirty: 'dirty',
    dragging: 'dragging',
    title: 'tab-title',
    close: 'tab-close',
  },
  dragThreshold: 5,   // 드래그로 인식하기 위한 최소 이동 거리(px)
  closeLabel: '\u00d7',
  closeTitle: 'Close',
  confirmMessage: (name) => `Do you want to save changes to ${name}?`,
}

// txt 저장 시 마크다운 기호를 뺀 순수 글자로 바꾸는 규칙
export const PLAIN_TEXT_CONFIG = {
  bulletMarker: '- ',         // 불렛 앞에 붙일 기호 (빈 문자열 ''로 바꾸면 기호 없이 저장)
  keepOrderedNumbers: true,   // 번호 목록의 "1. " 번호를 남길지 (false면 번호도 제거)
  indent: '  ',               // 기호가 없을 때 쓰는 하위 목록 들여쓰기 (공백 2칸)
  cellSeparator: '\t',        // 표의 칸 구분 (탭 문자)
  blockSeparator: '\n',     // 문단 사이 빈 줄
  lineSeparator: '\n',
}

// 문서 맨 끝에는 항상 빈 문단이 자동으로 유지됩니다. (저장 시에는 제거됨)
// blockTypes: 그 빈 문단이 이 블록들 바로 뒤에 있을 때는 Backspace로 지워지지 않게 막음
// 다른 블록에도 적용하려면 이름을 추가: 'codeBlock'(코드 블록), 'horizontalRule'(구분선), 'bulletList', 'orderedList'
export const TRAILING_CONFIG = {
  blockTypes: ['table', 'blockquote'],
}
