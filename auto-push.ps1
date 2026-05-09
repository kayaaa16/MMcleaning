# auto-push.ps1
# 監看資料夾，發現任何檔案變更就自動 git add + commit + push 到 GitHub。
# 使用方式：直接雙擊「啟動自動同步.bat」即可。

$folder = $PSScriptRoot
$logFile = Join-Path $folder "auto-push.log"
$pollInterval = 5  # 秒

function Log($msg) {
    $line = "[$(Get-Date -Format 'HH:mm:ss')] $msg"
    Write-Host $line -ForegroundColor Cyan
    Add-Content -Path $logFile -Value $line -Encoding utf8
}

Set-Location $folder

Clear-Host
Write-Host "============================================" -ForegroundColor Green
Write-Host "  寓見青旅 自動同步監看中" -ForegroundColor Green
Write-Host "  資料夾：$folder" -ForegroundColor Gray
Write-Host "  每 $pollInterval 秒檢查變更，發現後自動推送 GitHub" -ForegroundColor Gray
Write-Host "  GitHub Pages 約在推送後 30 秒~1 分鐘內反映" -ForegroundColor Gray
Write-Host "  關閉此視窗或按 Ctrl+C 即停止監看" -ForegroundColor Gray
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

Log "監看啟動"

while ($true) {
    Start-Sleep -Seconds $pollInterval

    $changes = git status --short
    if (-not $changes) { continue }

    Log "發現變更："
    $changes | ForEach-Object { Log "  $_" }

    git add .
    $msg = "auto: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    git commit -m $msg | Out-Null
    if ($?) {
        Log "已 commit: $msg"
    } else {
        Log "commit 失敗（可能沒有變更或衝突），跳過"
        continue
    }

    git push
    if ($?) {
        Log "推送成功 → GitHub"
    } else {
        Log "推送失敗，請查看上方錯誤訊息"
    }
    Write-Host ""
}
