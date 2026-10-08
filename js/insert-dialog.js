import { UI_CONFIG, DIALOG_CONFIG } from './config.js'
import { withApi } from './api.js'
import { normalizeImageSrc, getDocPath } from './doc-context.js'

// ---- 링크/이미지 입력 대화상자 ----
// 기본 우클릭 메뉴의 Insert Link / Insert Image에서 호출됩니다.
// - 링크: 선택 텍스트가 있으면 그 텍스트에 적용, 링크 위 커서면 수정/제거,
//   그 외에는 Text + URL을 입력받아 새 링크 텍스트를 삽입합니다.
// - 이미지: URL과 대체 텍스트(alt)를 입력받아 커서 위치에 삽입합니다.

export function setupInsertDialog(editor) {
  const ids = UI_CONFIG.dialog
  const visibleCls = UI_CONFIG.classes.visible
  const $ = id => document.getElementById(id)

  const backdrop = $(ids.backdropId)
  const titleEl = $(ids.titleId)
  const textRow = $(ids.textRowId)
  const altRow = $(ids.altRowId)
  const textInput = $(ids.textInputId)
  const urlInput = $(ids.urlInputId)
  const altInput = $(ids.altInputId)
  const removeBtn = $(ids.removeId)
  const browseBtn = $(ids.browseId)
  const blockedRe = new RegExp(DIALOG_CONFIG.blockedUrlPattern, 'i')

  let current = null      // 열려 있는 대화상자의 동작 { confirm, remove }
  let savedRange = null   // 대화상자를 열 때의 선택 범위 (닫을 때 복원)

  function open({ title, showText = false, showAlt = false, showBrowse = false, url = '', canRemove = false, confirm, remove }) {
    const { from, to } = editor.state.selection
    savedRange = { from, to }
    current = { confirm, remove }

    titleEl.textContent = title
    textRow.style.display = showText ? '' : 'none'
    altRow.style.display = showAlt ? '' : 'none'
    removeBtn.style.display = canRemove ? '' : 'none'
    browseBtn.style.display = showBrowse ? '' : 'none'
    textInput.value = ''
    urlInput.value = url
    altInput.value = ''

    backdrop.classList.add(visibleCls)
    urlInput.focus()
    urlInput.select()
  }

  // 닫으면서 에디터의 선택 범위와 포커스를 복원
  function close() {
    backdrop.classList.remove(visibleCls)
    const range = savedRange
    current = null
    savedRange = null
    if (range) editor.chain().focus().setTextSelection(range).run()
  }

  function submit() {
    if (!current) return
    const url = urlInput.value.trim()
    // URL이 비었거나 허용되지 않는 스킴이면 대화상자를 유지
    if (!url || blockedRe.test(url)) { urlInput.focus(); return }
    const values = { url, text: textInput.value.trim(), alt: altInput.value.trim() }
    const { confirm } = current
    close()
    confirm(values)
  }

  function removeLink() {
    if (!current || !current.remove) return
    const { remove } = current
    close()
    remove()
  }

  $(ids.okId).addEventListener('click', submit)
  $(ids.cancelId).addEventListener('click', close)
  removeBtn.addEventListener('click', removeLink)

  // 이미지 파일 선택: Python이 돌려준 src(상대 경로 또는 file:// URL)와 파일명(alt 기본값)을 채움
  browseBtn.addEventListener('click', () => {
    withApi(async (api) => {
      const result = await api.pick_image(getDocPath())
      if (!result || !result.ok) return
      urlInput.value = result.src
      if (!altInput.value) altInput.value = result.name
      urlInput.focus()
    })
  })

  // 바깥(배경) 클릭 시 취소. 메뉴 클릭의 mouseup과 겹치지 않도록 mousedown 사용
  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop) close()
  })

  backdrop.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close() }
    // 한글 등 IME 조합 중의 Enter는 조합 확정용이므로 제출하지 않음
    else if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); submit() }
  })

  function openLink() {
    const hasSelection = !editor.state.selection.empty
    const inLink = editor.isActive('link')
    const currentHref = inLink ? (editor.getAttributes('link').href || '') : ''

    if (hasSelection) {
      // 선택한 텍스트에 링크 적용 (이미 링크면 URL 수정/제거)
      open({
        title: inLink ? DIALOG_CONFIG.editLinkTitle : DIALOG_CONFIG.linkTitle,
        url: currentHref,
        canRemove: inLink,
        confirm: ({ url }) => editor.chain().focus().setLink({ href: url }).run(),
        remove: () => editor.chain().focus().unsetLink().run(),
      })
    } else {
      // 새 링크 텍스트 삽입 (Text가 비어 있으면 URL을 텍스트로 사용)
      open({
        title: DIALOG_CONFIG.linkTitle,
        showText: true,
        confirm: ({ url, text }) => editor.chain().focus().insertContent({
          type: 'text',
          text: text || url,
          marks: [{ type: 'link', attrs: { href: url } }],
        }).run(),
      })
    }
  }
  // 링크 수정 전용 (우클릭 Edit Link에서 호출)
  function editLink() {
    if (!editor.isActive('link')) return
    open({
      title: DIALOG_CONFIG.editLinkTitle,
      url: editor.getAttributes('link').href || '',
      canRemove: true,
      confirm: ({ url }) => editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run(),
      remove: () => editor.chain().focus().extendMarkRange('link').unsetLink().run(),
    })
  }

  function openImage() {
    open({
      title: DIALOG_CONFIG.imageTitle,
      //showAlt: true,
      showBrowse: true,
      confirm: ({ url, alt }) => editor.chain().focus().setImage({ src: normalizeImageSrc(url), alt }).run(),
    })
  }

  return { openLink, openImage, editLink }
}
