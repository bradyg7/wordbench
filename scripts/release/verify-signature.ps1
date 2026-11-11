param([Parameter(Mandatory = $true)][string]$ArtifactPath)
$ErrorActionPreference = 'Stop'
$signature = Get-AuthenticodeSignature -LiteralPath $ArtifactPath
@{ status = [string]$signature.Status; thumbprint = if ($signature.SignerCertificate) { $signature.SignerCertificate.Thumbprint } else { $null } } | ConvertTo-Json -Compress
