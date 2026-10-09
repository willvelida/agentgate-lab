#!/usr/bin/env pwsh
# Copyright (c) Microsoft Corporation.
# SPDX-License-Identifier: MIT
#Requires -Version 7.0

<#
.SYNOPSIS
    Runs a command and records local verification evidence.
.DESCRIPTION
    Records JSON metadata and raw output under .local/verification/.
    Commands run from the repository root. Output is local and may be sensitive.
    Node.js and Git must be on PATH.
.PARAMETER Command
    The executable or command shim to run.
.PARAMETER CommandArguments
    The command's arguments as an array, not a shell expression.
.PARAMETER Label
    A human-readable label for the check.
.EXAMPLE
    .\scripts\Invoke-Verification.ps1 -Command npm -CommandArguments @('test', '--prefix', 'src/Client') -Label 'Client tests'
.NOTES
    A nonzero command exit code is preserved. Runner failures exit with code 1.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$Command,

    [Parameter(Mandatory = $false)]
    [string[]]$CommandArguments = @(),

    [Parameter(Mandatory = $false)]
    [ValidateNotNullOrEmpty()]
    [string]$Label = 'verification'
)

$ErrorActionPreference = 'Stop'

#region Main Execution
if ($MyInvocation.InvocationName -ne '.') {
    try {
        $PSNativeCommandUseErrorActionPreference = $false
        $Runner = Join-Path $PSScriptRoot 'run-verification.mjs'
        & node $Runner --label $Label -- $Command @CommandArguments
        exit $LASTEXITCODE
    }
    catch {
        Write-Error -ErrorAction Continue "Verification wrapper failed: $($_.Exception.Message)"
        exit 1
    }
}
#endregion Main Execution
