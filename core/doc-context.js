// ---- 현재 문서의 위치 정보 ----
// 마크다운 안의 상대 경로 이미지(예: images/a.png)는 .md 파일이 있는 폴더 기준이므로,
// 화면에 표시할 때만 문서 폴더 기준 절대 URL로 바꿔 줍니다. (저장되는 값은 원래 경로 그대로)

let baseUrl = ''
let docPath = null

// 문서를 열거나 저장할 때 Python이 알려준 폴더 URL을 기록 (신규 문서면 빈 문자열)
export function setBaseUrl(url) {
  baseUrl = url || ''
}

// 현재 활성 문서의 파일 경로를 기록 (신규 문서면 null). 이미지 선택 시 상대 경로 계산에 사용
export function setDocPath(path) {
  docPath = path || null
}

export function getDocPath() {
  return docPath
}

// 상대 경로를 문서 폴더 기준 URL로 변환. 이미 절대 URL이거나 기준이 없으면 그대로 반환
export function resolveSrc(src) {
  if (!src || !baseUrl) return src
  try {
    return new URL(src, baseUrl).href
  } catch {
    return src
  }
}

// 사용자가 직접 입력한 Windows 절대 경로(C:\... 또는 C:/...)를 file:// URL로 변환
export function normalizeImageSrc(input) {
  // Windows 드라이브 경로 (C:\ 또는 C:/)
  if (/^[a-zA-Z]:[\\/]/.test(input)) return 'file:///' + input.replace(/\\/g, '/')
  // 리눅스/macOS 절대경로 (/home/user/img.png 등)
  if (/^\//.test(input)) return 'file://' + input
  return input
}
