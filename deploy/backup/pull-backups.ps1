$ErrorActionPreference = 'Stop'
$pullConfig = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'backup-pull.json') -Raw | ConvertFrom-Json
$pullRoot = [IO.Path]::GetFullPath($pullConfig.outputRoot)
$pullBatchPath = Join-Path $PSScriptRoot ('pull-' + [Guid]::NewGuid().ToString('N') + '.sftp')
$pullStatusPath = Join-Path $PSScriptRoot 'backup-pull-status.json'
function Remove-BackupFile([string]$Path) {
    $resolvedBackup = [IO.Path]::GetFullPath($Path)
    if (-not $resolvedBackup.StartsWith($pullRoot.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Caminho fora da pasta de backups.' }
    Remove-Item -LiteralPath $resolvedBackup -Force
}
try {
    $pullBatch = @()
    foreach ($instance in $pullConfig.instances) {
        if ($instance -notmatch '^[a-z0-9-]+$') { throw 'Nome de instância inválido.' }
        $localBackup = Join-Path $pullRoot $instance
        New-Item -ItemType Directory -Path $localBackup -Force | Out-Null
        $pullBatch += 'lcd "' + $localBackup.Replace('\','/') + '"'
        $pullBatch += 'get -p /srv/hadar-backups/' + $instance + '/status.json'
        $pullBatch += 'get -a -p /srv/hadar-backups/' + $instance + '/*.hgb'
        $pullBatch += 'get -p /srv/hadar-backups/' + $instance + '/*.json'
    }
    $pullBatch += 'bye'
    [IO.File]::WriteAllLines($pullBatchPath,$pullBatch,[Text.UTF8Encoding]::new($false))
    & sftp.exe -q -P $pullConfig.port -i $pullConfig.keyFile -o BatchMode=yes -o StrictHostKeyChecking=yes -o IdentitiesOnly=yes -b $pullBatchPath ($pullConfig.user + '@' + $pullConfig.host)
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível sincronizar os backups por SFTP.' }
    foreach ($instance in $pullConfig.instances) {
        $localBackup = Join-Path $pullRoot $instance
        $serverStatus = Get-Content -LiteralPath (Join-Path $localBackup 'status.json') -Raw | ConvertFrom-Json
        # PowerShell 7 can deserialize ISO dates as DateTime; Windows PowerShell
        # keeps strings. Preserve the timezone and avoid locale-dependent parsing.
        $backupCreatedAt = if ($serverStatus.createdAt -is [DateTime]) {
            [DateTimeOffset]$serverStatus.createdAt
        } else {
            [DateTimeOffset]::Parse($serverStatus.createdAt, [Globalization.CultureInfo]::InvariantCulture)
        }
        if ($serverStatus.status -ne 'ok' -or $backupCreatedAt -lt [DateTimeOffset]::UtcNow.AddHours(-30)) { throw "Backup ausente ou desatualizado: $instance" }
        $archives = @(Get-ChildItem -LiteralPath $localBackup -Filter '*.hgb' -File | Sort-Object LastWriteTimeUtc -Descending)
        foreach ($archive in $archives) {
            $manifestPath = [IO.Path]::ChangeExtension($archive.FullName,'.json')
            $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
            $actualHash = (Get-FileHash -LiteralPath $archive.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
            if ($actualHash -ne $manifest.sha256) { Remove-BackupFile $archive.FullName; throw "Cópia incompleta ou corrompida: $instance. A próxima execução tentará baixar novamente." }
            if ($archive -ne $archives[0] -and $archive.LastWriteTimeUtc -lt [DateTime]::UtcNow.AddDays(-30)) {
                Remove-BackupFile $archive.FullName
                Remove-BackupFile $manifestPath
            }
        }
    }
    @{status='ok';checkedAt=[DateTimeOffset]::UtcNow.ToString('o');instances=$pullConfig.instances} | ConvertTo-Json | Set-Content -LiteralPath $pullStatusPath -Encoding UTF8
    Write-Output 'Backups sincronizados e hashes conferidos.'
} catch {
    @{status='failed';checkedAt=[DateTimeOffset]::UtcNow.ToString('o');reason=$_.Exception.Message} | ConvertTo-Json | Set-Content -LiteralPath $pullStatusPath -Encoding UTF8
    Write-Error $_.Exception.Message
    exit 1
} finally {
    if (Test-Path -LiteralPath $pullBatchPath) { Remove-Item -LiteralPath $pullBatchPath -Force }
}
