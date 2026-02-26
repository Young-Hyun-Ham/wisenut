@echo off
setlocal
pushd "%~dp0" >nul

docker compose down --volumes
popd >nul
