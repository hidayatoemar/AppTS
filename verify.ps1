#!/usr/bin/env pwsh
$ErrorActionPreference = 'Stop'

$compose = @('compose', '-f', 'docker-compose.build.yml')
$run     = $compose + @('run', '--rm', 'verify')

function Step($label, [scriptblock]$block) {
    Write-Host ""
    Write-Host "==> $label" -ForegroundColor Cyan
    & $block
    if ($LASTEXITCODE -ne 0) {
        Write-Host "!! FAILED: $label (exit $LASTEXITCODE)" -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

$mode = if ($args.Count -gt 0) { $args[0] } else { 'all' }

switch ($mode) {
    'build' {
        Step 'docker build' { & docker @compose build }
    }
    'install' {
        Step 'npm ci' { & docker @run npm ci --ignore-scripts --no-audit --no-fund }
    }
    'toolchain' {
        Step 'verify:toolchain' { & docker @run npm run verify:toolchain }
    }
    'shell' {
        & docker @run bash
    }
    'run' {
        $shift = $args[1..($args.Count - 1)]
        & docker @run @shift
    }
    'all' {
        Step 'docker build'         { & docker @compose build }
        Step 'npm ci'               { & docker @run npm ci --ignore-scripts --no-audit --no-fund }
        Step 'verify:toolchain'     { & docker @run npm run verify:toolchain }
        Step 'verify:boundaries'    { & docker @run npm run verify:boundaries }
        Step 'typecheck'            { & docker @run npm run typecheck }
        Step 'build'                { & docker @run npm run build }
        Step 'test:contracts'       { & docker @run npm run test:contracts }
        Step 'test:integration'     { & docker @run npm run test:integration }
        Step 'test:dg04'            { & docker @run npm run test:dg04 }
        Step 'test:adverse'         { & docker @run npm run test:adverse }
        Write-Host ""
        Write-Host "==> ALL GATES PASSED" -ForegroundColor Green
    }
    default {
        Write-Host "Usage:" -ForegroundColor Yellow
        Write-Host "  ./verify.ps1                # build image + install + all 8 gates"
        Write-Host "  ./verify.ps1 build          # build image only"
        Write-Host "  ./verify.ps1 install        # npm ci only"
        Write-Host "  ./verify.ps1 toolchain      # only verify:toolchain gate"
        Write-Host "  ./verify.ps1 shell          # interactive bash inside container"
        Write-Host "  ./verify.ps1 run <cmd...>   # run arbitrary command inside container"
    }
}
