import { Selection } from './vendor.js'
import { IMAGE_CONFIG } from './config.js'
import { resolveSrc } from './doc-context.js'
import { getKnownImageUrl } from './image-fallback.js'

// ---- 이미지 크기 조절 ----
// 기본 Image 확장에 width 속성과 드래그 핸들(NodeView)을 추가합니다.
// - 이미지를 클릭해 선택하면 모서리 4곳에 핸들이 나타나고, 드래그하면 비율을 유지한 채 너비가 바뀝니다.
// - 이미지를 더블클릭하면 원래 크기로 되돌립니다.
// - 크기는 노드의 width 속성(px)으로 저장되며, 마크다운에는 <img width="..."> 태그로 기록됩니다.

export function withResize(Image) {
  const cls = IMAGE_CONFIG.classes

  return Image.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        width: {
          default: null,
          // HTML의 width 속성(예: <img width="300">)을 숫자로 읽음
          parseHTML: (el) => {
            const w = parseInt(el.getAttribute('width'), 10)
            return Number.isFinite(w) && w > 0 ? w : null
          },
          renderHTML: (attrs) => (attrs.width ? { width: attrs.width } : {}),
        },
      }
    },

    // 복사/HTML 직렬화용: 상대 경로를 문서 폴더 기준 URL로 변환
    renderHTML({ HTMLAttributes }) {
      return ['img', { ...HTMLAttributes, src: resolveSrc(HTMLAttributes.src) }]
    },

    addNodeView() {
      return ({ node, editor, getPos }) => {
        let currentNode = node
        let intendedSrc = null // 마지막으로 지정한 원래 src (대체 표시로 img.src가 바뀌어도 비교 기준 유지)

        const wrap = document.createElement('span')
        wrap.className = cls.wrap
        const img = document.createElement('img')
        wrap.appendChild(img)

        const handles = IMAGE_CONFIG.handles.map((pos) => {
          const handle = document.createElement('span')
          handle.className = `${cls.handle} ${cls.handle}-${pos}`
          handle.dataset.pos = pos
          wrap.appendChild(handle)
          return handle
        })

        function render() {
          const { src, alt, title, width } = currentNode.attrs
          const resolved = resolveSrc(src)
          // src가 실제로 바뀔 때만 다시 지정 (로드 실패 후 대체 주소로 바꾼 값을 되돌리지 않기 위함)
          if (resolved !== intendedSrc) {
            intendedSrc = resolved
            delete img.dataset.fallback
            const known = getKnownImageUrl(resolved)
            if (known) img.dataset.fallback = '1' // 대체 주소를 이미 알고 있으므로 재시도 불필요
            img.src = known || resolved
          }
          img.alt = alt || ''
          if (title) img.title = title
          else img.removeAttribute('title')
          img.style.width = width ? `${width}px` : ''
        }

        // 너비를 노드 속성으로 저장 (null이면 원래 크기)
        function commitWidth(width) {
          const pos = getPos()
          if (typeof pos !== 'number') return
          const tr = editor.state.tr.setNodeMarkup(pos, undefined, { ...currentNode.attrs, width })
          // setNodeMarkup 뒤에는 선택이 풀리므로, 계속 크기를 조절할 수 있게 이미지를 다시 선택
          tr.setSelection(Selection.fromJSON(tr.doc, { type: 'node', anchor: pos }))
          editor.view.dispatch(tr)
        }

        handles.forEach((handle) => {
          handle.addEventListener('mousedown', (e) => {
            e.preventDefault()
            e.stopPropagation()
            // 오른쪽 아래 핸들 하나만 있으므로 오른쪽으로 끌수록 커짐
            const startX = e.clientX
            const startRect = img.getBoundingClientRect()
            const startWidth = startRect.width
            const ratio = startRect.height / startRect.width
            const maxWidth = editor.view.dom.clientWidth
            let width = startWidth

            // 드래그 중에는 이미지를 감싼 상자의 크기를 처음 크기로 고정합니다.
            // 이미지가 줄어드는 동안 주변 글자가 다시 배치되어 이미지가 갑자기 다른 줄로 튀거나
            // 문서 높이가 줄어 화면이 밀리는 현상을 막기 위함이며, 놓는 순간 한 번만 새로 배치됩니다.
            wrap.classList.add(cls.resizing)

            const onMove = (ev) => {
              width = Math.min(Math.max(startWidth + (ev.clientX - startX), IMAGE_CONFIG.minWidth), maxWidth)
              const height = width * ratio
              // 커질 때는 상자도 함께 커지고, 작아질 때는 처음 크기를 유지
              wrap.style.setProperty('--box-w', `${Math.max(startWidth, width)}px`)
              wrap.style.setProperty('--box-h', `${Math.max(startRect.height, height)}px`)
              // 핸들이 줄어든 이미지의 모서리를 따라가도록 이미지 크기를 전달
              wrap.style.setProperty('--img-w', `${width}px`)
              wrap.style.setProperty('--img-h', `${height}px`)
              img.style.width = `${Math.round(width)}px`
            }
            const onUp = () => {
              document.removeEventListener('mousemove', onMove)
              document.removeEventListener('mouseup', onUp)
              wrap.classList.remove(cls.resizing)
              for (const name of ['--box-w', '--box-h', '--img-w', '--img-h']) wrap.style.removeProperty(name)
              commitWidth(Math.round(width))
            }
            onMove(e) // 시작 시점의 상자 크기와 핸들 위치를 먼저 확정
            document.addEventListener('mousemove', onMove)
            document.addEventListener('mouseup', onUp)
          })
        })

        img.addEventListener('dblclick', () => {
          if (currentNode.attrs.width) commitWidth(null)
        })

        render()

        return {
          dom: wrap,
          update(updatedNode) {
            if (updatedNode.type !== currentNode.type) return false
            currentNode = updatedNode
            render()
            return true
          },
          selectNode() { wrap.classList.add(cls.selected) },
          deselectNode() { wrap.classList.remove(cls.selected) },
          // 핸들 조작은 ProseMirror가 처리하지 않도록 함
          stopEvent: (event) => handles.includes(event.target),
          // 이 노드 안의 DOM 변경(스타일, 클래스 등)은 문서 변경으로 취급하지 않음
          ignoreMutation: () => true,
        }
      }
    },
  })
}
