import { setBaseUrl, setDocPath } from './doc-context.js'
import { askSave, isConfirmOpen } from './confirm-dialog.js'
import { setupTabBar } from './tab-bar.js'
import { UI_CONFIG, EDITOR_CONFIG, FILE_CONFIG } from './config.js'

// ---- 탭 관리 ----
// 문서마다 독립된 탭(내용, 경로, 수정 여부, 실행 취소 기록, 스크롤 위치)을 유지합니다.
// 탭 전환은 에디터의 상태(EditorState) 자체를 통째로 교체하는 방식이라
// 탭마다 실행 취소 기록이 따로 보존됩니다.
// 탭 바 그리기/드래그는 tab-bar.js, 단축키는 shortcuts.js가 담당합니다.
//
// deps.save(): 활성 탭을 저장하고 성공 여부(boolean)를 반환하는 함수
// deps.quit(): 프로그램을 종료하는 함수

export function setupTabs(editor, { save, quit }) {
  const scroller = document.querySelector(EDITOR_CONFIG.selector)

  // vendor.js가 EditorState를 내보내지 않으므로 현재 상태의 생성자를 재사용
  const EditorState = editor.state.constructor

  let tabs = []
  let activeTab = null
  let nextId = 1

  const bar = setupTabBar(document.getElementById(UI_CONFIG.tabBarId), {
    getTabs: () => tabs,
    getActive: () => activeTab,
    activate,
    close: closeTab,
    move,
  })
  const render = () => bar.render()

  function createBlankState() {
    return EditorState.create({ schema: editor.state.schema, plugins: editor.state.plugins })
  }

  // 활성 문서의 위치 정보를 이미지 경로 처리 모듈에 반영
  function syncContext(tab) {
    setBaseUrl(tab.baseUrl)
    setDocPath(tab.path)
  }

  // 이미지 노드가 있으면(NodeView 재생성 필요) 빈 상태를 거쳐 교체, 없으면 바로 교체해
  // 불필요한 이중 렌더링을 생략
  function swapState(state) {
    let hasImage = false
    state.doc.descendants(node => {
      if (node.type.name === 'image') hasImage = true
      return !hasImage
    })
    if (hasImage) editor.view.updateState(createBlankState())
    editor.view.updateState(state)
  }

  // 현재 활성 탭의 상태와 스크롤 위치를 보관
  function saveActiveView() {
    if (!activeTab) return
    activeTab.state = editor.state
    activeTab.scrollTop = scroller.scrollTop
  }

  // 내용을 로드하되 실행 취소 기록에는 남기지 않음
  function loadContent(html) {
    editor.chain().setMeta('addToHistory', false).setContent(html).focus('start').run()
  }

  // 탭 순서 변경 (화면 갱신은 호출한 쪽이 담당)
  function move(from, to) {
    tabs.splice(to, 0, tabs.splice(from, 1)[0])
  }

  function activate(tab) {
    if (tab === activeTab) return
    saveActiveView()
    activeTab = tab
    syncContext(tab)
    swapState(tab.state)
    scroller.scrollTop = tab.scrollTop
    render()
    document.dispatchEvent(new CustomEvent('tabchange'))
    editor.view.focus()
  }

  // 새 탭을 열거나, 같은 파일이 이미 열려 있으면 그 탭으로 전환
  // opts: { title, path, key, baseUrl, html, reuseActive }
  function openTab(opts) {
    const existing = opts.key && tabs.find(t => t.key === opts.key)
    if (existing) { activate(existing); return }

    const meta = {
      title: opts.title,
      path: opts.path || null,
      key: opts.key || null,
      baseUrl: opts.baseUrl || '',
      dirty: false,
    }

    // 아직 손대지 않은 빈 탭이면 새 탭을 만들지 않고 그 탭에 내용을 채움 (시작 파일 용도)
    if (opts.reuseActive && activeTab && !activeTab.dirty && !activeTab.path) {
      Object.assign(activeTab, meta)
      syncContext(activeTab)
      loadContent(opts.html)
      render()
      return
    }

    saveActiveView()
    const tab = { id: nextId++, ...meta, state: null, scrollTop: 0 }
    tabs.push(tab)
    activeTab = tab
    syncContext(tab)
    editor.view.updateState(createBlankState())
    loadContent(opts.html)
    tab.state = editor.state
    scroller.scrollTop = 0
    render()
    document.dispatchEvent(new CustomEvent('tabchange'))
  }

  function newTab() {
    openTab({ title: FILE_CONFIG.defaultTitle, html: EDITOR_CONFIG.emptyContent })
  }

  // 지정한 탭의 정보를 갱신 (저장 후 경로/파일명/수정 여부 반영)
  // 저장이 끝나기 전에 활성 탭이 바뀌었을 수 있으므로, 활성 탭이 아니라 대상 탭을 직접 받음
  function updateTab(tab, fields) {
    Object.assign(tab, fields)
    if (tab === activeTab) syncContext(tab)
    render()
  }

  function setDirty(dirty) {
    if (!activeTab || activeTab.dirty === dirty) return
    activeTab.dirty = dirty
    render()
  }

  // 저장되지 않은 탭을 버려도 되는지 사용자에게 확인. 진행해도 되면 true
  async function resolveDirty(tab) {
    if (!tab.dirty) return true
    activate(tab) // 저장 대상 내용을 에디터에 올림
    const choice = await askSave(tab.title)
    if (choice === 'discard') return true
    if (choice === 'save' && await save()) return true
    editor.view.focus()
    return false
  }

  async function closeTab(tab) {
    if (isConfirmOpen()) return false
    if (!(await resolveDirty(tab))) return false

    const index = tabs.indexOf(tab)
    tabs.splice(index, 1)

    // 마지막 탭을 닫으면 프로그램 종료
    if (!tabs.length) {
      activeTab = null
      quit()
      return true
    }

    if (tab === activeTab) {
      activeTab = null // 닫힌 탭의 상태를 다시 저장하지 않도록 비움
      activate(tabs[Math.min(index, tabs.length - 1)])
    } else {
      render()
    }
    return true
  }

  // 창 종료 전, 저장하지 않은 모든 탭을 차례로 확인. 종료해도 되면 true
  async function confirmCloseAll() {
    if (isConfirmOpen()) return false
    for (const tab of [...tabs]) {
      if (!(await resolveDirty(tab))) return false
    }
    return true
  }

  // 활성 탭을 제외한, 다른 탭들이 열어 둔 파일 키 목록 (같은 파일로 저장하는 것을 막는 데 사용)
  function getOtherKeys() {
    return tabs.filter(t => t !== activeTab && t.key).map(t => t.key)
  }

  function switchBy(step) {
    if (tabs.length < 2) return
    const index = (tabs.indexOf(activeTab) + step + tabs.length) % tabs.length
    activate(tabs[index])
  }

  // 시작 시 에디터에 이미 떠 있는 문서를 첫 탭으로 등록
  activeTab = {
    id: nextId++,
    title: FILE_CONFIG.defaultTitle,
    path: null,
    key: null,
    baseUrl: '',
    dirty: false,
    state: editor.state,
    scrollTop: 0,
  }
  tabs.push(activeTab)
  syncContext(activeTab)
  render()

  return {
    openTab,
    newTab,
    // 마지막 탭을 닫아 종료가 진행되는 짧은 사이에 들어온 입력은 무시
    closeActive: () => (activeTab ? closeTab(activeTab) : false),
    switchBy,
    updateTab,
    setDirty,
    confirmCloseAll,
    getActive: () => activeTab,
    getOtherKeys,
  }
}
