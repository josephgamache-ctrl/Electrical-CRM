param(
  [string]$Output = ".\\release.zip"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$stagingRoot = Join-Path $env:TEMP ("ma_electrical_release_" + [Guid]::NewGuid().ToString("N"))

New-Item -ItemType Directory -Path $stagingRoot | Out-Null

$excludeDirs = @(
  "backups",
  "frontend\\node_modules",
  "frontend\\build",
  "frontend\\dist",
  "backend\\__pycache__",
  "frontend\\.cache",
  ".claude",
  "nginx\\certs",
  "nginx\\ssl"
)

$excludeFiles = @(
  ".env",
  ".env.*",
  "backend\\.env",
  "backend\\.env.*",
  "*.log"
)

Write-Host "Staging repo from: $repoRoot"
Write-Host "Staging to:        $stagingRoot"
Write-Host "Output zip:        $Output"

foreach ($dir in $excludeDirs) {
  $full = Join-Path $repoRoot $dir
  if (Test-Path $full) { Write-Host "Excluding dir:      $dir" }
}

Write-Host "Excluding files:    $($excludeFiles -join ', ')"

# Copy everything except exclusions
$robocopyArgs = @(
  $repoRoot,
  $stagingRoot,
  "/MIR",
  "/R:1",
  "/W:1",
  "/NFL",
  "/NDL",
  "/NJH",
  "/NJS",
  "/NP"
)

foreach ($d in $excludeDirs) { $robocopyArgs += "/XD"; $robocopyArgs += (Join-Path $repoRoot $d) }
foreach ($f in $excludeFiles) { $robocopyArgs += "/XF"; $robocopyArgs += $f }

& robocopy @robocopyArgs | Out-Null

if (Test-Path $Output) { Remove-Item -Force $Output }
Compress-Archive -Path (Join-Path $stagingRoot "*") -DestinationPath $Output

Remove-Item -Recurse -Force $stagingRoot

Write-Host "Release package created: $Output"

