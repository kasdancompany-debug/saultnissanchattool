# One-shot: push .env.local to saultnissanchattool-br58 (production). No secret output.
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

$publishable = $null
$vars = @{}
Get-Content ".env.local" | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith("#")) { return }
  $eq = $line.IndexOf("=")
  if ($eq -lt 1) { return }
  $key = $line.Substring(0, $eq).Trim()
  $val = $line.Substring($eq + 1).Trim().Trim('"').Trim("'")
  if ($val) { $vars[$key] = $val }
}

if ($vars["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]) {
  $publishable = $vars["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]
  $vars["NEXT_PUBLIC_SUPABASE_ANON_KEY"] = $publishable
}
$vars["NEXT_PUBLIC_APP_URL"] = "https://saultnissanchattool-br58.vercel.app"

npx vercel link --project saultnissanchattool-br58 --yes | Out-Null

$order = @(
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_APP_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "AI_INBOUND_CLASSIFICATION_ENABLED",
  "AI_SERVICE_AFTER_HOURS_AUTOREPLY"
)

foreach ($key in $order) {
  if (-not $vars.ContainsKey($key)) { continue }
  Write-Host "+ $key"
  & npx vercel env add $key production --value $vars[$key] --yes --force 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Failed: $key" }
}

Write-Host "OK"
