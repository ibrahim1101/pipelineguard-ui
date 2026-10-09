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
