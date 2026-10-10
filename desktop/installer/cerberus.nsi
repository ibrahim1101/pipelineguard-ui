!ifndef CERBERUS_PAYLOAD
  !error "CERBERUS_PAYLOAD must be supplied as an absolute path"
!endif
!ifndef CERBERUS_OUTPUT
  !error "CERBERUS_OUTPUT must be supplied as an absolute path"
!endif
Unicode true
!include "MUI2.nsh"
Name "Cerberus"
OutFile "${CERBERUS_OUTPUT}"
InstallDir "$LOCALAPPDATA\Programs\Cerberus"
RequestExecutionLevel user
SetCompressor /SOLID lzma
!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

; Abort before extracting binaries if the installed CERBERUS GUI or bridge is running.
; Never kill processes automatically or touch unrelated applications.
Function .onInit
  ; UTF-16LE encoded PowerShell avoids NSIS and shell quoting ambiguity.
  nsExec::ExecToStack 'powershell.exe -NoProfile -NonInteractive -EncodedCommand JAByAG8AbwB0ACAAPQAgAEoAbwBpAG4ALQBQAGEAdABoACAAKABKAG8AaQBuAC0AUABhAHQAaAAgACQAZQBuAHYAOgBMAE8AQwBBAEwAQQBQAFAARABBAFQAQQAgACcAUAByAG8AZwByAGEAbQBzACcAKQAgACcAQwBlAHIAYgBlAHIAdQBzACcACgB0AHIAeQAgAHsACgAgACAAJABiAHUAcwB5ACAAPQAgAEAAKABHAGUAdAAtAEMAaQBtAEkAbgBzAHQAYQBuAGMAZQAgAFcAaQBuADMAMgBfAFAAcgBvAGMAZQBzAHMAIAAtAEUAcgByAG8AcgBBAGMAdABpAG8AbgAgAFMAdABvAHAAIAB8ACAAVwBoAGUAcgBlAC0ATwBiAGoAZQBjAHQAIAB7AAoAIAAgACAAIAAkAF8ALgBOAGEAbQBlACAALQBpAG4AIABAACgAJwBDAGUAcgBiAGUAcgB1AHMALgBlAHgAZQAnACwAIAAnAGMAZQByAGIAZQByAHUAcwAtAGIAcgBpAGQAZwBlAC4AZQB4AGUAJwApACAALQBhAG4AZAAKACAAIAAgACAAJABfAC4ARQB4AGUAYwB1AHQAYQBiAGwAZQBQAGEAdABoACAALQBhAG4AZAAKACAAIAAgACAAJABfAC4ARQB4AGUAYwB1AHQAYQBiAGwAZQBQAGEAdABoAC4AUwB0AGEAcgB0AHMAVwBpAHQAaAAoACQAcgBvAG8AdAAgACsAIABbAGMAaABhAHIAXQA5ADIALAAgAFsAUwB0AHIAaQBuAGcAQwBvAG0AcABhAHIAZQBzAG8AbgBdADoAOgBPAHIAZABpAG4AYQBsAEkAZwBuAG8AcgBlAEMAYQBzAGUAKQAKACAAIAB9ACkACgAgACAAaQBmACAAKAAkAGIAdQBzAHkALgBDAG8AdQBuAHQAIAAtAGcAdAAgADAAKQAgAHsAIABlAHgAaQB0ACAAMQAwACAAfQAKACAAIABlAHgAaQB0ACAAMAAKAH0AIABjAGEAdABjAGgAIAB7ACAAZQB4AGkAdAAgADIAMAAgAH0ACgA='
  Pop $0
  Pop $1
  StrCmp $0 "0" clear
  StrCmp $0 "10" running
  SetErrorLevel 20
  IfSilent +2
    MessageBox MB_ICONSTOP|MB_OK "Could not verify whether CERBERUS is running. No files were changed. Please retry after closing CERBERUS."
  Abort
running:
  SetErrorLevel 10
  IfSilent +2
    MessageBox MB_ICONEXCLAMATION|MB_OK "CERBERUS or its bridge is still running. Close CERBERUS before installing or upgrading. No files were changed."
  Abort
clear:
FunctionEnd

Section "Cerberus" SecMain
  SetOutPath "$INSTDIR"
  File "${CERBERUS_PAYLOAD}\Cerberus.exe"
  File /r "${CERBERUS_PAYLOAD}\cerberus-runtime"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateDirectory "$SMPROGRAMS\Cerberus"
  CreateShortcut "$SMPROGRAMS\Cerberus\Cerberus.lnk" "$INSTDIR\Cerberus.exe"
  CreateShortcut "$SMPROGRAMS\Cerberus\Uninstall Cerberus.lnk" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Cerberus" "DisplayName" "Cerberus"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Cerberus" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Cerberus" "InstallLocation" "$INSTDIR"
SectionEnd

Section "Uninstall"
  Delete "$SMPROGRAMS\Cerberus\Cerberus.lnk"
  Delete "$SMPROGRAMS\Cerberus\Uninstall Cerberus.lnk"
  RMDir "$SMPROGRAMS\Cerberus"
  Delete "$INSTDIR\Cerberus.exe"
  RMDir /r "$INSTDIR\cerberus-runtime"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Cerberus"
SectionEnd
