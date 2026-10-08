import { htmlToMarkdown, markdownToHtml } from './markdown.js'
import { htmlToPlainText } from './plain-text.js'
import { withApi } from './api.js'
import { setupTabs } from './tabs.js'
import { setupShortcuts } from './shortcuts.js'
import { UI_CONFIG, FILE_CONFIG, MESSAGES_CONFIG as MSG } from './config.js'

// Python이 돌려준 파일 정보를 탭 생성 옵션으로 변환
function toTabOptions(result) {
  return {
    title: result.filename,
    path: result.path,
    key: result.key,
    baseUrl: result.base_url,
    // 파일 열기 경로에서만 빈 헤더 행을 제거해 '헤더 없음' 상태를 복원
    html: markdownToHtml(result.content, { stripEmptyHeader: true }),
  }
}

export function setupFileIO(editor, findBar) {
  const statusEl = document.getElementById(UI_CONFIG.statusId)
  const statusBarEl = document.getElementById('status-bar')

function setStatus(text) {
  statusEl.textContent = text
  statusBarEl.classList.toggle('visible', !!text)
  if (text) setTimeout(() => {
    if (statusEl.textContent === text) {
      statusBarEl.classList.remove('visible')
      setTimeout(() => {
        if (!statusBarEl.classList.contains('visible')) statusEl.textContent = ''
      }, 220) // --anim-duration(0.22s)과 맞춘 값
    }
  }, FILE_CONFIG.statusDuration)
}
  
    // 활성 탭을 저장하고 성공 여부를 반환 (사용자가 취소하거나 실패하면 false)
  // saveAs가 true이거나 아직 저장된 적 없는 탭이면 저장 대화상자를 띄움
  // 마크다운 버전과 순수 글자 버전을 함께 보내면, Python이 파일 확장자(.txt 여부)에 맞는 쪽을 저장함
  function save(saveAs = false) {
    return new Promise((resolve) => {
      withApi(async (api) => {
        try {
          setStatus(MSG.saving)
          // 저장을 시작한 시점의 탭을 기억해, 도중에 탭이 바뀌어도 그 탭을 갱신
          const tab = tabs.getActive()
          if (!tab) { setStatus(''); resolve(false); return } // 종료 진행 중이라 저장할 탭이 없음
          const json = editor.getJSON()
          const markdown = htmlToMarkdown(json)
          const plainText = htmlToPlainText(json)
          // 다른 탭에서 이미 열려 있는 파일로는 저장하지 못하도록 키 목록을 함께 전달
          const blockedKeys = tabs.getOtherKeys()
          const result = saveAs
            ? await api.save_file_as(markdown, blockedKeys, plainText)
            : await api.save_file(markdown, tab.path, blockedKeys, plainText)
          if (!result || result.canceled) { setStatus(''); resolve(false); return }
          if (!result.ok) { setStatus(MSG.saveFailed + result.error); resolve(false); return }

          tabs.updateTab(tab, {
            path: result.path,
            key: result.key,
            title: result.filename,
            baseUrl: result.base_url,
            dirty: false,
          })
          setStatus(MSG.saved + result.filename)
          resolve(true)
        } catch (err) {
          setStatus(MSG.saveFailed + err)
          resolve(false)
        }
      })
    })
  }

  function openFile() {
    withApi(async (api) => {
      setStatus(MSG.opening)
      const result = await api.open_file_dialog()
      if (!result || result.canceled) { setStatus(''); return }
      if (!result.ok) { setStatus(MSG.openFailed + result.error); return }

      tabs.openTab(toTabOptions(result))
      setStatus(MSG.opened + result.filename)
    })
  }

  const newWindow = () => withApi(api => api.new_window())

  const tabs = setupTabs(editor, {
    save: () => save(false),
    quit: () => withApi(api => api.quit()),
  })
  setupShortcuts(tabs, { save: () => save(false), open: openFile, newWindow }, findBar)

  editor.on('update', () => tabs.setDirty(true))

  // 창의 X 버튼으로 종료를 시도하면 Python이 전역 함수를 호출함
  // 함수 이름은 Python이 정하므로(get_app_config) 한 곳에서만 관리됨
  // 저장하지 않은 탭을 모두 확인한 뒤에만 실제로 종료
  withApi(async (api) => {
    const { close_handler } = await api.get_app_config()
    window[close_handler] = async () => {
      if (await tabs.confirmCloseAll()) api.quit()
    }
  })

  // 더블클릭/명령줄로 전달된 시작 파일이 있으면 첫 탭에 자동으로 불러옵니다.
  withApi(async (api) => {
    const result = await api.get_initial_file()
    if (!result || result.none) return
    if (!result.ok) { setStatus(MSG.openFailed + result.error); return }

    tabs.openTab({ ...toTabOptions(result), reuseActive: true })
    setStatus(MSG.opened + result.filename)
  })

  // 우클릭 메뉴에서 호출할 수 있도록 동작을 반환
  return {
    newFile: () => tabs.newTab(),
    openFile,
    saveFile: () => { save(false) },
    saveFileAs: () => { save(true) },
  }
}
