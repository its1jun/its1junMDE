// ---- ProseMirror JSON -> Markdown 직접 변환 (외부 HTML 파서 라이브러리 미사용) ----
// turndown 등 외부 HTML 파서 라이브러리는 브라우저 DOM 파싱을
// 신뢰할 수 없게 만드는 사례가 있어, Tiptap의 editor.getJSON() 구조를
// 직접 순회하며 변환합니다. StarterKit/표/링크/이미지가 만들어내는 노드/마크 타입만 다룹니다.

import { marked as markedInstance } from './vendor.js'
import { MARKDOWN_CONFIG as MD } from './config.js'

// URL 안의 공백과 괄호는 마크다운 링크 문법을 깨뜨리므로 퍼센트 인코딩
function escapeUrl(url = '') {
  return url.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29')
}

function marksToMarkdown(text, marks = []) {
  let out = text
  for (const mark of marks) {
    if (mark.type === 'bold') out = `${MD.bold}${out}${MD.bold}`
    else if (mark.type === 'italic') out = `${MD.italic}${out}${MD.italic}`
    else if (mark.type === 'strike') out = `${MD.strike}${out}${MD.strike}`
    else if (mark.type === 'code') out = `${MD.code}${out}${MD.code}`
    else if (mark.type === 'link') out = `${MD.linkOpen}${out}${MD.linkMid}${escapeUrl(mark.attrs?.href)}${MD.linkClose}`
  }
  return out
}

// HTML 속성 값 안에서 깨지지 않도록 특수문자를 이스케이프
function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function imageToMarkdown(node) {
  // 속성이 null일 수 있으므로(예: alt 없는 <img>) 기본값은 || 로 처리
  const src = node.attrs?.src || ''
  const alt = node.attrs?.alt || ''
  const title = node.attrs?.title || ''
  const width = node.attrs?.width

  // 마크다운 문법에는 크기 지정이 없으므로, 크기를 조절한 이미지는 HTML <img> 태그로 기록
  if (width) {
    const attrs = [`src="${escapeAttr(src)}"`, `alt="${escapeAttr(alt)}"`]
    if (title) attrs.push(`title="${escapeAttr(title)}"`)
    attrs.push(`width="${width}"`)
    return `<img ${attrs.join(' ')}>`
  }

  const titlePart = title ? ` "${title.replace(/"/g, '\\"')}"` : ''
  return `${MD.imagePrefix}${MD.linkOpen}${alt.replace(/[\[\]]/g, '')}${MD.linkMid}${escapeUrl(src)}${titlePart}${MD.linkClose}`
}

function inlineToMarkdown(content = []) {
  return content.map(node => {
    if (node.type === 'text') return marksToMarkdown(node.text, node.marks)
    if (node.type === 'hardBreak') return MD.hardBreak
    if (node.type === 'image') return imageToMarkdown(node)
    return ''
  }).join('')
}

const isList = node => node.type === 'bulletList' || node.type === 'orderedList'

// 형제 블록들을 하나의 마크다운 문자열로 이어 붙임.
// tight=true(리스트 항목 내부)일 때는 문단 바로 뒤의 중첩 리스트를 빈 줄 없이 붙임.
function blocksToMarkdown(nodes = [], tight = false) {
  // 문자열을 +로 반복 연결하지 않고 배열에 모았다가 한 번에 join (대용량 문서에서 재할당 비용 절감)
  const pieces = []
  nodes.forEach((node, i) => {
    if (i > 0) {
      pieces.push(tight && isList(node) && nodes[i - 1].type === 'paragraph'
        ? MD.lineSeparator
        : MD.blockSeparator)
    }
    pieces.push(blockToMarkdown(node))
  })
  return pieces.join('')
}

// 리스트 항목 안의 모든 블록(문단, 인용문, 코드, 중첩 리스트 등)을 처리.
// 첫 줄은 마커(-, 1.)를 붙이고, 나머지 줄은 마커 너비만큼 들여써서 항목에 귀속시킴.
function listToMarkdown(node, ordered) {
  const start = ordered ? (node.attrs?.start ?? 1) : 1
  return (node.content || []).map((item, i) => {
    const prefix = ordered ? `${start + i}${MD.orderedSuffix}` : MD.bullet
    const [first = '', ...rest] = blocksToMarkdown(item.content, true).split(MD.lineSeparator)
    const pad = ' '.repeat(prefix.length)
    return [
      (prefix + first).trimEnd(),
      ...rest.map(line => (line ? pad + line : line)),
    ].join(MD.lineSeparator)
  }).join(MD.lineSeparator)
}

// 셀 내용을 한 줄 인라인 텍스트로 평탄화 (마크다운 표는 인라인만 지원)
function cellToMarkdown(cell) {
  return (cell.content || [])
    .map(child => inlineToMarkdown(child.content || []))
    .join(' ')
    // 정규식 2개를 순차 스캔하지 않고 하나로 통합해 한 번에 처리
    .replace(/[|\n]/g, ch => (ch === '|' ? '\\|' : ' '))
    .trim()
}

function tableToMarkdown(node) {
  const rowNodes = node.content || []
  if (!rowNodes.length) return ''
  // 첫 행이 전부 헤더 셀일 때만 헤더 있는 표로 취급 (Toggle Header 상태 반영)
  const hasHeader = (rowNodes[0].content || []).every(cell => cell.type === 'tableHeader')
  const rows = rowNodes.map(row => (row.content || []).map(cellToMarkdown))
  const colCount = Math.max(...rows.map(r => r.length))
  const pad = r => Array.from({ length: colCount }, (_, i) => r[i] || '')
  const toLine = cells => MD.tablePipe + cells.map(c => MD.tableCellPad + c + MD.tableCellPad).join(MD.tablePipe) + MD.tablePipe
  const divider = toLine(Array.from({ length: colCount }, () => MD.tableDivider))
  const padded = rows.map(pad)
  // GFM은 헤더 행이 필수이므로, 헤더가 없는 표는 빈 헤더 행을 넣어 기록함
  // (다시 열 때 빈 헤더 행은 markdownToHtml에서 제거되어 '헤더 없음' 상태가 복원됨)
  const head = hasHeader ? padded[0] : pad([])
  const body = hasHeader ? padded.slice(1) : padded
  return [toLine(head), divider, ...body.map(toLine)].join(MD.lineSeparator)
}

function blockToMarkdown(node) {
  switch (node.type) {
    case 'heading':
      return MD.heading.repeat(node.attrs.level) + ' ' + inlineToMarkdown(node.content)
    case 'paragraph':
      return inlineToMarkdown(node.content || [])
    case 'blockquote':
      // 인용문 안의 문단 구분(빈 줄)을 보존하기 위해 빈 줄에는 '>'만 붙임
      return blocksToMarkdown(node.content)
        .split(MD.lineSeparator)
        .map(line => (line ? MD.quote + line : MD.quote.trimEnd()))
        .join(MD.lineSeparator)
    case 'codeBlock': {
      const lang = node.attrs?.language || ''
      const code = (node.content || []).map(n => n.text).join('')
      return MD.codeFence + lang + MD.lineSeparator + code + MD.lineSeparator + MD.codeFence
    }
    case 'bulletList':
      return listToMarkdown(node, false)
    case 'orderedList':
      return listToMarkdown(node, true)
    case 'horizontalRule':
      return MD.hr
    case 'table':
      return tableToMarkdown(node)
    default:
      return inlineToMarkdown(node.content || [])
  }
}

export function htmlToMarkdown(json) {
  // json: editor.getJSON() 결과 (doc 노드)
  return blocksToMarkdown(json.content || []).trim() + MD.lineSeparator
}

export function markdownToHtml(markdown, { stripEmptyHeader = false } = {}) {
  const html = markedInstance.parse(markdown)
  // 파일 열기 경로에서만 '헤더 없음' 상태를 복원한다. (Convert to Table은 헤더를 유지해야 함)
  if (!stripEmptyHeader) return html
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('table > thead').forEach(thead => {
    const cells = [...thead.querySelectorAll('th')]
    const hasBody = thead.parentElement.querySelector('tbody')
    if (hasBody && cells.length && cells.every(th => !th.textContent.trim())) thead.remove()
  })
  return doc.body.innerHTML
}