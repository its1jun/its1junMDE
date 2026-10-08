@echo off
rem 이 파일은 installer 폴더 안에 있으며, 어디서 실행해도 상위(프로젝트) 폴더로 이동해서 빌드합니다.
rem 프로젝트 폴더에는 main.py, index.html, css 폴더, js 폴더가 있어야 합니다.
rem 결과물은 installer\dist\its1junMDE 폴더에 만들어지며, 이 폴더 전체를 배포합니다.

rem 이 파일이 있는 폴더(%~dp0)의 한 단계 위 = 프로젝트 폴더로 이동
cd /d "%~dp0.."

pip install --upgrade pyinstaller pywebview
if errorlevel 1 goto :fail

pyinstaller --noconfirm --clean --onedir --windowed ^
  --name its1junMDE ^
  --distpath "installer\dist" ^
  --add-data "index.html;." ^
  --add-data "css;css" ^
  --add-data "js;js" ^
  --icon "installer\app.ico" ^
  main.py
if errorlevel 1 goto :fail

rem 빌드가 끝나면 임시 파일(build 폴더, .spec 파일)을 지웁니다.
if exist build rmdir /s /q build
if exist its1junMDE.spec del /q its1junMDE.spec

echo.
echo Build finished: installer\dist\its1junMDE\its1junMDE.exe
pause
exit /b 0

:fail
echo.
echo Build failed.
pause
exit /b 1