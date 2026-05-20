# Sync .env.local to Vercel (production + preview). Run from repo root.
param(
  [string[]]$Projects = @("saultnissanchattool-br58", "saulnissanchattool"),
  [hashtable]$AppUrlByProject = @{
    "saultnissanchattool-br58" = "https://saultnissanchattool-br58.vercel.app"
    "saulnissanchattool"       = "https://saulnissanchattool.vercel.app"
    "saultnissanchattool"      = "https://saultnissanchattool.vercel.app"
  }
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$envPath = Join-Path $root ".env.local"
if (-not (Test-Path $envPath)) {
  throw ".env.local not found at $envPath"
}

function Parse-EnvFile([string]$path) {
  $vars = @{}
  Get-Content $path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $eq = $line.IndexOf("=")
    if ($eq -lt 1) { return }
    $key = $line.Substring(0, $eq).Trim()
    $val = $line.Substring($eq + 1).Trim()
    if (
      ($val.StartsWith('"') -and $val.EndsWith('"')) -or
      ($val.StartsWith("'") -and $val.EndsWith("'"))
    ) {
      $val = $val.Substring(1, $val.Length - 2)
    }
    if ($val.Length -gt 0) {
      $vars[$key] = $val
    }
  }
  return $vars
}

$vars = Parse-EnvFile $envPath
# Production is enough for the live site; preview needs --value (not stdin) on some projects.
$environments = @("production")

foreach ($project in $Projects) {
  Write-Host "`n=== Project: $project ===" -ForegroundColor Cyan
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  npx vercel link --project $project --yes 2>&1 | Out-Host
  $ErrorActionPreference = $prevEap
  if ($LASTEXITCODE -ne 0) { throw "vercel link failed for $project" }

  if ($AppUrlByProject.ContainsKey($project)) {
    $vars["NEXT_PUBLIC_APP_URL"] = $AppUrlByProject[$project]
  }

  foreach ($key in $vars.Keys) {
    $value = $vars[$key]
    $tmp = [System.IO.Path]::GetTempFileName()
    try {
      [System.IO.File]::WriteAllText($tmp, $value)
      foreach ($env in $environments) {
        Write-Host "  + $key ($env)" -ForegroundColor DarkGray
        $prevEap = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        $argList = @("vercel", "env", "add", $key, $env, "--yes", "--force", "--value", $value)
        & npx @argList 2>&1 | Out-Host
        $ErrorActionPreference = $prevEap
        if ($LASTEXITCODE -ne 0) {
          throw "vercel env add failed: $key $env (exit $LASTEXITCODE)"
        }
      }
    }
    finally {
      Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    }
  }
}

Write-Host "`nDone. Redeploy each project so NEXT_PUBLIC_* are baked in." -ForegroundColor Green
