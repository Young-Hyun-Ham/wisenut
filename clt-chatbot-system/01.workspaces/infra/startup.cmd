@echo off
setlocal
pushd "%~dp0" >nul

rem 기본값을 devnoturbo로 설정하되, 사용자가 직접 NEXT_DEV_CMD를 주입할 수 있습니다.
if "%NEXT_DEV_CMD%"=="" (
  set "NEXT_DEV_CMD=devnoturbo"
)

docker compose up -d --build
popd >nul
