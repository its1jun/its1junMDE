import { PLAIN_TEXT_CONFIG as PT } from './config.js'

const isList = node => node.type === 'bulletList' || node.type === 'orderedList'

// 글자 한 줄 안의 내용을 서식(굵게, 링크 등) 없이 글자만 이어 붙임
// 링크는 글자만 남기고 주소는 버리며, 이미지는 설명(alt)만 남김
function inlineToText(content = []) {
  return content.map(node => {
    if (node.type === 'text') return node.text
    if (node.type === 'hardBreak') return PT.lineSeparator
    if (node.type === 'image') return node.attrs?.alt || ''
    return ''
  }).join('')
}

// 형제 블록들을 하나의 글자 덩어리로 이어 붙임. 내용이 빈 블록(빈 줄, 구분선)은 건너뜀
// tight=true(리스트 항목 내부)일 때는 문단 바로 뒤의 중첩 리스트를 빈 줄 없이 붙임
function blocksToText(nodes = [], tight = false) {
  const pieces = []
  let prev = null
  nodes.forEach(node => {
    const text = blockToText(node)
    if (!text) return
    if (prev) {
      pieces.push(tight && isList(node) && prev.type === 'paragraph' ? PT.lineSeparator : PT.blockSeparator)
    }
    pieces.push(text)
    prev = node
  })
  return pieces.join('')
}

// 목록: 불렛은 설정한 기호(bulletMarker)를, 번호 목록은 번호를 앞에 붙임 (하위 목록은 기호 너비만큼 들여쓰기)
function listToText(node, ordered) {
  const start = ordered ? (node.attrs?.start ?? 1) : 1
  return (node.content || []).map((item, i) => {
    const prefix = ordered
      ? (PT.keepOrderedNumbers ? `${start + i}. ` : '')
      : PT.bulletMarker
    const [first = '', ...rest] = blocksToText(item.content, true).split(PT.lineSeparator)
    const pad = prefix ? ' '.repeat(prefix.length) : PT.indent
    return [
      prefix + first,
      ...rest.map(line => (line ? pad + line : line)),
    ].join(PT.lineSeparator)
  }).join(PT.lineSeparator)
}

// 표: 한 행을 한 줄로, 칸은 탭으로 구분
function tableToText(node) {
  return (node.content || []).map(row =>
    (row.content || []).map(cell =>
      (cell.content || []).map(child => inlineToText(child.content || [])).join(' ').replace(/\n/g, ' ').trim()
    ).join(PT.cellSeparator)
  ).join(PT.lineSeparator)
}

function blockToText(node) {
  switch (node.type) {
    case 'bulletList':
      return listToText(node, false)
    case 'orderedList':
      return listToText(node, true)
    case 'blockquote':
      return blocksToText(node.content)
    case 'codeBlock':
      // 코드 끝의 줄바꿈은 블록 사이 빈 줄과 겹치므로 제거
      return (node.content || []).map(n => n.text).join('').replace(/\n+$/, '')
    case 'horizontalRule':
      return ''
    case 'table':
      return tableToText(node)
    default:
      // heading, paragraph 등 글자를 직접 가진 블록
      return inlineToText(node.content || [])
  }
}

// editor.getJSON() 결과를 마크다운 기호 없는 순수 글자로 변환 (txt 저장용)
export function htmlToPlainText(json) {
  return blocksToText(json.content || []).trim() + PT.lineSeparator
}