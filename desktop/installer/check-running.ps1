# Fail closed if an installed CERBERUS process is running or enumeration fails.
# Exit 0 = clear; 10 = installed process running; 20 = preflight error.
try {
    $root = Join-Path (Join-Path $env:LOCALAPPDATA 'Programs') 'Cerberus'
    $busy = @(Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object {
        $_.Name -in @('Cerberus.exe', 'cerberus-bridge.exe') -and
        $_.ExecutablePath -and
        $_.ExecutablePath.StartsWith($root + [char]92, [StringComparison]::OrdinalIgnoreCase)
    })
    if ($busy.Count -gt 0) { exit 10 }
    exit 0
} catch {
    [Console]::Error.WriteLine("CERBERUS preflight failed: $($_.Exception.Message)")
    exit 20
}
