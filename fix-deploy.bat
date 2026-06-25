@echo off
cd /d C:\Users\Utente\Desktop\dedomo-repo
del /f /q .git\HEAD.lock 2>nul
del /f /q .git\index.lock 2>nul
git push
echo.
pause
