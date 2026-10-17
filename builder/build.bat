@echo off
rem 이 파일은 builder 폴더 안에 있으며, 어디서 실행해도 상위(프로젝트) 폴더로 이동해서 빌드합니다.
rem 프로젝트 폴더에는 main.py, index.html, core 폴더, features 폴더가 있어야 합니다.
rem 결과물은 builder\dist\its1junMDE 폴더에 만들어지며, 이 폴더 전체를 배포합니다.

rem 이 파일이 들어 있는 폴더 이름 (폴더 이름을 바꾸면 이 값만 같이 바꾸세요)
set BUILD_DIR=builder

rem 이 파일이 있는 폴더(%~dp0)의 한 단계 위 = 프로젝트 폴더로 이동
cd /d "%~dp0.."

pip install --upgrade pyinstaller pywebview
if errorlevel 1 goto :fail

rem 이전 빌드 결과물을 완전히 지워 찌꺼기 파일이 배포되지 않게 함
if exist "%BUILD_DIR%\dist" rmdir /s /q "%BUILD_DIR%\dist"

pyinstaller --noconfirm --clean --onedir --windowed ^
  --name its1junMDE ^
  --distpath "%BUILD_DIR%\dist" ^
  --add-data "index.html;." ^
  --add-data "core;core" ^
  --add-data "features;features" ^
  --icon "%BUILD_DIR%\app.ico" ^
  main.py
if errorlevel 1 goto :fail

rem 빌드가 끝나면 임시 파일(build 폴더, .spec 파일)을 지웁니다.
if exist build rmdir /s /q build
if exist its1junMDE.spec del /q its1junMDE.spec

echo.
echo Build finished: %BUILD_DIR%\dist\its1junMDE\its1junMDE.exe
pause
exit /b 0

:fail
echo.
echo Build failed.
pause
exit /b 1