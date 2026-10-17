; ============================================================
;  its1junMDE(마크다운 에디터) Inno Setup 스크립트
;
;  사용법:
;    1) Inno Setup(무료)을 설치하세요: https://jrsoftware.org/isinfo.php
;    2) 이 파일을 build.bat으로 만든 dist\its1junMDE 폴더와
;       "같은 프로젝트 폴더"에 두거나, 아래 SourceDir 값을
;       실제 경로로 수정하세요.
;    3) Inno Setup Compiler에서 이 파일을 열고 Build > Compile
;       (또는 초록색 재생 버튼) 클릭하세요.
;    4) Output\its1junMDE-Setup.exe 파일이 생성됩니다.
;       이 파일 하나만 배포하면 됩니다.
; ============================================================

#define MyAppName "its1junMDE"
#define MyAppVersion "1.0.0"
#define MyAppExeName "its1junMDE.exe"
; PyInstaller가 만든 dist\its1junMDE 폴더 경로.
; SourcePath는 "이 .iss 파일이 있는 폴더(installer)"를 가리키는 Inno Setup 내장 매크로입니다.
; dist 폴더도 installer 안에 생기므로 SourcePath 바로 뒤에 붙여 찾습니다.
#define SourceDir SourcePath + "dist\its1junMDE"

[Setup]
AppId={{8F3B2C10-4A5D-4E7A-9C1B-ITS1JUNMDE001}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
; 기본 설치 위치: C:\Program Files\its1junMDE
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
; 결과물(Setup.exe)이 생성될 폴더
OutputDir=Output
OutputBaseFilename={#MyAppName}-Setup
SetupIconFile={#SourcePath}app.ico
Compression=lzma2
SolidCompression=yes
; Program Files에 설치하므로 관리자 권한 요청 (자동으로 UAC 팝업 처리)
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\{#MyAppExeName}
WizardStyle=modern

[Languages]
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"

[Tasks]
; 설치 중 "바탕화면에 바로가기 만들기" 체크박스 (선택사항)
Name: "desktopicon"; Description: "바탕화면에 바로가기 만들기"; GroupDescription: "추가 아이콘:"; Flags: unchecked
; .md 파일을 이 프로그램으로 여는 기본 프로그램으로 등록할지 선택 (기본 체크됨)
Name: "associatemd"; Description: ".md 파일을 {#MyAppName}(으)로 열기"; GroupDescription: "파일 연결:"

[Files]
; dist\its1junMDE 폴더 전체(exe + _internal 등)를 통째로 포함
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
; 시작 메뉴 바로가기 (모든 사용자 공용). 표시 이름은 그대로 두고,
; Comment(설명) 속성에만 md, mde 키워드를 넣어 Windows 검색에서
; "md"나 "mde"로 입력해도 매칭될 가능성을 높임
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Comment: "md mde markdown editor its1junMDE"
; 제어판 "프로그램 추가/제거"에 나타나는 제거 항목
Name: "{group}\{#MyAppName} 제거"; Filename: "{uninstallexe}"
; 선택 시에만 생성되는 바탕화면 바로가기
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Registry]
; .md 확장자를 "ItsJunMDE.Document"라는 내부 이름과 연결
Root: HKCR; Subkey: ".md"; ValueType: string; ValueName: ""; ValueData: "ItsJunMDE.Document"; Flags: uninsdeletevalue; Tasks: associatemd
; "ItsJunMDE.Document"가 실제로 무엇인지 정의 (설명 텍스트)
Root: HKCR; Subkey: "ItsJunMDE.Document"; ValueType: string; ValueName: ""; ValueData: "Markdown Document"; Flags: uninsdeletekey; Tasks: associatemd
; 파일 탐색기에 표시할 아이콘 (exe 안에 내장된 아이콘의 0번째 사용)
Root: HKCR; Subkey: "ItsJunMDE.Document\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\{#MyAppExeName},0"; Tasks: associatemd
; 더블클릭하거나 "열기"를 선택했을 때 실행할 명령어 (파일 경로를 %1로 인자 전달)
Root: HKCR; Subkey: "ItsJunMDE.Document\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"" ""%1"""; Tasks: associatemd

[Run]
; 설치 완료 후 "바로 실행" 체크박스와 함께 실행 옵션 제공
Filename: "{app}\{#MyAppExeName}"; Description: "{#MyAppName} 바로 실행하기"; Flags: nowait postinstall skipifsilent

[Code]
const
  SHCNE_ASSOCCHANGED = $08000000;
  SHCNF_IDLIST = $0000;

procedure SHChangeNotify(wEventId: Integer; uFlags: Integer; dwItem1, dwItem2: Integer);
  external 'SHChangeNotify@shell32.dll stdcall';

procedure CurStepChanged(CurStep: TSetupStep);
begin
  // 파일 연결(.md 아이콘 등) 변경 후 탐색기가 재부팅 없이 즉시 반영하도록 알림
  if CurStep = ssPostInstall then
    SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, 0, 0);
end;
