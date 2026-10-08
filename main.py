"""
5단계: 탭
pywebview API <-> JS 브릿지로 파일 열기/저장 기능 연결.
탭(문서 목록)은 JS가 관리하고, Python은 파일 경로를 인자로 받아 처리하는 무상태 API만 제공합니다.
마크다운(.md) <-> Tiptap HTML 변환은 프론트엔드(JS)에서 turndown/marked로 처리하고,
Python 쪽은 순수하게 파일 시스템 접근(열기 대화상자, 읽기/쓰기)만 담당합니다.
"""

import os
import sys
import functools
import importlib
import http.server
import mimetypes
import secrets
import shutil
import subprocess
import threading
import webbrowser
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import url2pathname
import webview


def api_error_handler(func):
    """
    Api 메서드 공통 예외 처리 데코레이터.
    예외 발생 시 {"ok": False, "error": str(e)} 형태로 통일해 반환합니다.
    """
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            return {"ok": False, "error": str(e)}
    return wrapper

# PyInstaller 빌드 시 리소스는 sys._MEIPASS(onedir: _internal 폴더) 아래에 풀립니다.
BASE_DIR = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
INDEX_PATH = os.path.join(BASE_DIR, "index.html")

# 파일 관련 상수는 Python이 단독으로 관리합니다. (JS는 저장 대화상자를 직접 다루지 않음)
DEFAULT_FILENAME = "untitled.md"
FILE_EXTENSION = ".md"                      # 확장자 없이 저장할 때 붙는 기본 확장자
FILE_EXTENSIONS = (".md", ".txt")           # 그대로 인정하는 확장자 목록
PLAIN_TEXT_EXTENSION = ".txt"               # 이 확장자로 저장하면 마크다운 기호 없는 순수 글자로 저장
FILE_TYPES = ("Markdown Files (*.md)", "Text Files (*.txt)", "All files (*.*)")

# 창 닫기 요청을 받을 JS 전역 함수 이름. JS는 get_app_config()로 이 이름을 받아 함수를 등록합니다.
CLOSE_HANDLER_NAME = "requestAppClose"

# 이미지 선택 대화상자 필터와 외부 브라우저로 열 수 있는 링크 스킴 (Python에서만 사용)
# GTK는 세미콜론 구분 다중 확장자 필터를 신뢰성 있게 해석하지 못하는 알려진 이슈가 있어
# 확장자별로 분리된 필터 항목을 함께 제공합니다. (Windows/Qt는 다중 확장자 항목을 그대로 사용)
IMAGE_FILE_TYPES = (
    "Image Files (*.png;*.jpg;*.jpeg;*.gif;*.webp;*.svg;*.bmp)",
    "PNG (*.png)",
    "JPEG (*.jpg;*.jpeg)",
    "GIF (*.gif)",
    "WebP (*.webp)",
    "SVG (*.svg)",
    "Bitmap (*.bmp)",
    "All files (*.*)",
)
ALLOWED_LINK_SCHEMES = ("http", "https", "mailto")
ALREADY_OPEN_ERROR = "This file is already open in another tab."
IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico")


class ImageServer:
    """
    로컬 이미지 파일을 127.0.0.1의 임시 HTTP 주소로 제공하는 작은 서버입니다.
    WebView가 file:// 이미지를 직접 불러오지 못하므로, 이미지를 http 주소로 대신 제공합니다.
    - 등록된 파일만, 추측할 수 없는 임의 토큰 주소로만 제공합니다. (임의 경로 접근 불가)
    - 파일을 통째로 메모리에 올리지 않고 스트리밍하므로 큰 이미지도 문제없습니다.
    """

    def __init__(self):
        self._files = {}    # 토큰 -> 파일 경로
        self._tokens = {}   # 파일 경로 -> 토큰 (같은 파일은 같은 주소 재사용)
        outer = self

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                token = self.path.split("?", 1)[0].lstrip("/")
                path = outer._files.get(token)
                if not path or not os.path.isfile(path):
                    self.send_error(404)
                    return
                try:
                    self.send_response(200)
                    self.send_header("Content-Type", mimetypes.guess_type(path)[0] or "application/octet-stream")
                    self.send_header("Content-Length", str(os.path.getsize(path)))
                    self.send_header("Cache-Control", "no-cache")
                    self.end_headers()
                    with open(path, "rb") as f:
                        shutil.copyfileobj(f, self.wfile)
                except (BrokenPipeError, ConnectionResetError):
                    pass  # 브라우저가 로딩을 중단한 경우

            def log_message(self, *args):
                pass  # 콘솔 로그 출력 안 함

        # 일부 리눅스 배포판(컨테이너, 엄격한 방화벽 정책)에서는 127.0.0.1 바인딩이
        # 제한될 수 있어, 실패 시 localhost 호스트명으로 한 번 더 시도합니다.
        try:
            self._server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        except OSError:
            self._server = http.server.ThreadingHTTPServer(("localhost", 0), Handler)
        self._port = self._server.server_address[1]
        threading.Thread(target=self._server.serve_forever, daemon=True).start()

    def url_for(self, path):
        token = self._tokens.get(path)
        if token is None:
            token = secrets.token_urlsafe(16)
            self._tokens[path] = token
            self._files[token] = path
        return f"http://127.0.0.1:{self._port}/{token}"


class Api:
    """
    window.pywebview.api.<method_name>() 형태로 JS에서 호출되는 브릿지 클래스.
    모든 메서드는 dict를 반환하여 JS 쪽에서 성공/실패를 일관되게 처리할 수 있게 합니다.
    """

    def __init__(self, initial_path=None):
        self._window = None
        self._image_server = None  # 첫 이미지 요청 시 시작
        self._initial_path = initial_path  # 더블클릭/명령줄로 전달된 시작 파일 경로
        self.force_close = False  # True이면 창 닫기를 그대로 허용 (저장 확인이 끝난 뒤)

    @api_error_handler
    def get_initial_file(self):
        """
        시작 인자로 전달된 파일이 있으면 읽어서 반환합니다. (JS가 시작 직후 1회 호출)
        없으면 {"ok": True, "none": True} 를 반환해 기본 빈 문서로 시작하게 합니다.
        """
        path = self._initial_path
        self._initial_path = None  # 한 번만 사용
        if not path:
            return {"ok": True, "none": True}
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        return self._file_result(path, content)

    def set_window(self, window):
        self._window = window

    @staticmethod
    def _base_url(path):
        """
        문서가 있는 폴더의 file:// URL(끝에 '/' 포함)을 반환합니다. 경로가 없으면(신규 문서) 빈 문자열.
        JS가 마크다운 안의 상대 경로 이미지를 화면에 표시할 때 기준 경로로 사용합니다.
        """
        if not path:
            return ""
        return Path(os.path.dirname(path)).as_uri() + "/"

    @staticmethod
    def _file_key(path):
        """
        같은 파일이 이미 열려 있는지 비교하기 위한 키 (절대 경로 + Windows 대소문자 정규화).
        """
        return os.path.normcase(os.path.abspath(path))

    def _file_result(self, path, content=None):
        """
        JS가 탭 정보를 갱신하는 데 필요한 공통 응답을 만듭니다.
        """
        result = {
            "ok": True,
            "path": path,
            "key": self._file_key(path),
            "filename": os.path.basename(path),
            "base_url": self._base_url(path),
        }
        if content is not None:
            result["content"] = content
        return result

    def pick_image(self, doc_path=None):
        """
        이미지 파일 선택 대화상자를 띄우고, 마크다운에 기록할 src를 반환합니다.
        doc_path는 현재 활성 문서의 경로입니다. (JS가 전달)
        - 문서가 저장된 상태면 문서 폴더 기준 상대 경로 (다른 드라이브면 절대 file:// URL)
        - 신규 문서면 절대 file:// URL
        """
        result = self._window.create_file_dialog(
            webview.OPEN_DIALOG,
            allow_multiple=False,
            file_types=IMAGE_FILE_TYPES,
        )
        if not result:
            return {"ok": False, "canceled": True}

        path = result[0]
        src = Path(path).as_uri()
        if doc_path:
            try:
                rel = os.path.relpath(path, os.path.dirname(doc_path))
                src = rel.replace(os.sep, "/")
            except ValueError:
                pass  # 드라이브가 달라 상대 경로를 만들 수 없으면 절대 URL 유지
        name = os.path.splitext(os.path.basename(path))[0]
        return {"ok": True, "src": src, "name": name}

    @api_error_handler
    def image_url(self, src):
        """
        로컬 이미지 파일(file:// URL 또는 경로)을 화면에 표시할 수 있는 http 주소로 바꿔 반환합니다.
        WebView가 file:// 이미지를 직접 불러오지 못할 때 JS가 이미지 로드 실패 시 호출합니다.
        안전을 위해 이미지 확장자의 실제 파일만 제공합니다.
        """
        parsed = urlparse(src)
        if parsed.scheme == "file":
            # 네트워크 공유(file://서버/공유폴더/...)는 Windows에서만 UNC 경로로 복원
            if sys.platform.startswith("win") and parsed.netloc and parsed.netloc != "localhost":
                path = url2pathname("//" + parsed.netloc + parsed.path)
            else:
                path = url2pathname(parsed.path)
        elif len(parsed.scheme) <= 1:
            path = src  # 스킴이 없거나 Windows 드라이브 문자(C:\...)인 로컬 경로
        else:
            return {"ok": False, "error": "Unsupported URL scheme"}

        if os.path.splitext(path)[1].lower() not in IMAGE_EXTENSIONS:
            return {"ok": False, "error": "Not an image file"}
        if not os.path.isfile(path):
            return {"ok": False, "error": "File not found: " + path}

        if self._image_server is None:
            self._image_server = ImageServer()
        return {"ok": True, "url": self._image_server.url_for(path)}

    @api_error_handler
    def open_external(self, url):
        """
        링크를 시스템 기본 브라우저로 엽니다. 안전을 위해 http/https/mailto만 허용합니다.
        """
        if urlparse(url).scheme.lower() not in ALLOWED_LINK_SCHEMES:
            return {"ok": False, "error": "Unsupported URL scheme"}
        webbrowser.open(url)
        return {"ok": True}

    @api_error_handler
    def open_file_dialog(self):
        """
        파일 열기 대화상자를 띄우고, 선택된 .md 파일의 내용을 읽어 반환합니다.
        어느 탭에서 열지는 JS가 결정하므로 Python은 상태를 저장하지 않습니다.
        """
        result = self._window.create_file_dialog(
            webview.OPEN_DIALOG,
            allow_multiple=False,
            file_types=FILE_TYPES,
        )
        if not result:
            return {"ok": False, "canceled": True}

        path = result[0]
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        return self._file_result(path, content)

    @staticmethod
    def _text_for_path(path, markdown_text, plain_text=None):
        """
        저장할 내용을 고릅니다. .txt 파일이고 순수 글자 버전이 있으면 그것을, 아니면 마크다운 원문을 반환합니다.
        """
        if plain_text is not None and path.lower().endswith(PLAIN_TEXT_EXTENSION):
            return plain_text
        return markdown_text

    @api_error_handler
    def save_file(self, markdown_text, path=None, blocked_keys=None, plain_text=None):
        """
        path(활성 탭의 파일 경로)가 있으면 그 경로에 바로 저장(덮어쓰기).
        없으면 save_file_as와 동일하게 동작(다른 이름으로 저장 대화상자).
        blocked_keys는 다른 탭이 이미 열고 있는 파일들의 키 목록입니다.
        """
        if not path:
            return self.save_file_as(markdown_text, blocked_keys, plain_text)
        with open(path, "w", encoding="utf-8") as f:
            f.write(self._text_for_path(path, markdown_text, plain_text))
        return self._file_result(path)

    @api_error_handler
    def save_file_as(self, markdown_text, blocked_keys=None, plain_text=None):
        """
        저장 대화상자를 띄워 새 경로를 지정받고, 그 경로에 저장합니다.
        새 경로는 JS가 해당 탭의 경로로 기록합니다.
        .md/.txt가 아닌 이름이면 기본 확장자(.md)를 붙이고, .txt면 순수 글자 버전을 저장합니다.
        선택한 경로가 blocked_keys에 있으면(다른 탭에서 이미 열린 파일) 저장하지 않고 오류를 반환합니다.
        """
        result = self._window.create_file_dialog(
            webview.SAVE_DIALOG,
            save_filename=DEFAULT_FILENAME,
            file_types=FILE_TYPES,
        )
        if not result:
            return {"ok": False, "canceled": True}

        path = result if isinstance(result, str) else result[0]
        if not path.lower().endswith(FILE_EXTENSIONS):
            path += FILE_EXTENSION

        if blocked_keys and self._file_key(path) in blocked_keys:
            return {"ok": False, "error": ALREADY_OPEN_ERROR}

        with open(path, "w", encoding="utf-8") as f:
            f.write(self._text_for_path(path, markdown_text, plain_text))
        return self._file_result(path)
    
    @api_error_handler
    def new_window(self):
        """
        프로그램을 새 프로세스로 한 번 더 실행해 빈 문서가 있는 새 창을 엽니다.
        """
        if getattr(sys, "frozen", False):
            command = [sys.executable]  # PyInstaller로 빌드된 실행 파일
        else:
            command = [sys.executable, os.path.abspath(__file__)]
        # 빌드본이 자기 자신을 다시 실행할 때 필요 (플랫폼 중립적인 값).
        # 단, Windows용 .exe와 Linux용 바이너리는 PyInstaller로 각각 별도 빌드해야 하며
        # 자동 크로스 컴파일은 지원되지 않습니다.
        env = dict(os.environ, PYINSTALLER_RESET_ENVIRONMENT="1")
        subprocess.Popen(command, env=env, close_fds=True)
        return {"ok": True}

    def get_app_config(self):
        """
        JS가 시작할 때 한 번 호출해 Python 쪽에서 정한 값을 받아 갑니다.
        """
        return {"ok": True, "close_handler": CLOSE_HANDLER_NAME}

    def request_close(self):
        """
        창 닫기 요청을 JS에 넘겨 저장하지 않은 탭을 확인하게 합니다.
        JS 쪽 처리 함수가 없거나 실패하면 그대로 종료합니다.
        """
        try:
            handled = self._window.evaluate_js(
                f"typeof window['{CLOSE_HANDLER_NAME}'] === 'function' && (window['{CLOSE_HANDLER_NAME}'](), true)"
            )
        except Exception:
            handled = False
        if not handled:
            self.quit()

    def quit(self):
        """
        확인 절차 없이 프로그램을 종료합니다. (JS가 저장 확인을 마친 뒤 호출)
        """
        self.force_close = True
        self._window.destroy()


def get_startup_path():
    """sys.argv[1]이 실제 존재하는 파일이면 절대경로로 반환, 아니면 None."""
    if len(sys.argv) < 2:
        return None
    path = os.path.abspath(sys.argv[1])
    return path if os.path.isfile(path) else None


def main():
    # 지금 사용 중인 모니터 기준 창 크기 비율(가로 51.172%, 세로 53.588%)을
    # 다른 모니터에서도 동일하게 재현하기 위해 화면 해상도에서 계산
    screens = webview.screens
    screen_width = screens[0].width if screens else 1536
    screen_height = screens[0].height if screens else 864
    start_width = round(screen_width * 0.5)
    start_height = round(screen_height * 0.55)

    api = Api(initial_path=get_startup_path())
    window = webview.create_window(
        title="itsJunMDE",
        url=INDEX_PATH,
        js_api=api,
        width=start_width,
        height=start_height,
        min_size=(600, 400),
    )
    api.set_window(window)

    def on_closing():
        # 확인이 끝났으면 그대로 닫고, 아니면 닫기를 취소한 뒤 JS에 확인을 맡김
        if api.force_close:
            return True
        # 이 핸들러 안에서 바로 evaluate_js를 호출하면 UI 스레드와 교착될 수 있어 별도 스레드로 실행
        threading.Thread(target=api.request_close, daemon=True).start()
        return False

    window.events.closing += on_closing

    # 리눅스에서는 렌더링 엔진(gtk/qt)을 명시적으로 시도해야 설치 여부에 따라
    # 조용히 실행 실패하는 상황을 피할 수 있습니다. Windows/macOS는 자동 선택에 맡깁니다.
    if sys.platform.startswith("linux"):
        gui_backend = None
        for candidate in ("gtk", "qt"):
            try:
                importlib.import_module("webview.platforms." + candidate)
                gui_backend = candidate
                break
            except ImportError:
                continue
        if gui_backend is None:
            sys.stderr.write(
                "pywebview용 GTK 또는 QT 백엔드를 찾을 수 없습니다. "
                "'pip install pywebview[gtk]' 또는 'pip install pywebview[qt]'로 설치해주세요.\n"
            )
        webview.start(debug=False, gui=gui_backend)
    else:
        webview.start(debug=False)


if __name__ == "__main__":
    main()