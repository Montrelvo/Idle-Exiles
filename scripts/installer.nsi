Unicode true
!include "MUI2.nsh"
!include "x64.nsh"

Name "Idle Exiles"
OutFile "${OUTPUT}"
InstallDir "$LOCALAPPDATA\Programs\Idle Exiles"
RequestExecutionLevel user
SetCompressor lzma
VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "Idle Exiles"
VIAddVersionKey "FileDescription" "Idle Exiles Windows Setup"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" "Idle Exiles contributors"

!define APPKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\IdleExiles"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "Idle Exiles requires 64-bit Windows."
    Abort
  ${EndIf}
FunctionEnd

Section "Idle Exiles"
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  File /r "${PAYLOAD}\*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateShortcut "$SMPROGRAMS\Idle Exiles.lnk" "$INSTDIR\Idle-Exiles.exe"
  WriteRegStr HKCU "${APPKEY}" "DisplayName" "Idle Exiles"
  WriteRegStr HKCU "${APPKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${APPKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${APPKEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKCU "${APPKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${APPKEY}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  Delete "$SMPROGRAMS\Idle Exiles.lnk"
  DeleteRegKey HKCU "${APPKEY}"
  !include "${CLEANUP}"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
SectionEnd
