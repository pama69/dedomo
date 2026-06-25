@echo off
cd /d C:\Users\Utente\Desktop\dedomo-repo
del /f /q .git\HEAD.lock 2>nul
del /f /q .git\index.lock 2>nul
git add CLAUDE.md fix-commit.bat fix-deploy.bat
git commit -m "chore: aggiorna CLAUDE.md sessione 25giu + bat file git workflow"
echo.
pause
