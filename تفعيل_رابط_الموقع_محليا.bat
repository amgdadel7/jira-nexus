@echo off
chcp 65001 >nul
echo ====================================================
echo  تفعيل الوصول المباشر لـ Jira Nexus على Cloudflare
echo ====================================================
echo.
echo جاري إضافة خوادم Cloudflare لتجاوز أي حظر DNS محلي...
echo.

powershell -Command "Start-Process powershell -Verb RunAs -ArgumentList '-Command \"$entry1 = ''172.67.135.1 jira-nexus.pages.dev''; $entry2 = ''172.67.135.1 jira-nexus.jira-nexus.workers.dev''; $file = ''%windir%\system32\drivers\etc\hosts''; $c = Get-Content $file -Raw; if (-not $c.Contains(''jira-nexus.pages.dev'')) { Add-Content -Path $file -Value (''`n'' + $entry1) }; if (-not $c.Contains(''jira-nexus.workers.dev'')) { Add-Content -Path $file -Value (''`n'' + $entry2) }; ipconfig /flushdns; Write-Host ''`n[SUCCESS] تم تفعيل الروابط بنجاح! يمكنك الآن فتح الموقع في المتصفح.'' -ForegroundColor Green; Start-Sleep -Seconds 3\"'"

pause
