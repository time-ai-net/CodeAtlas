# Direct test of RDS repository API
$repoUrl = "https://github.com/Time-Open-Source-Foundation/RDS"
$apiUrl = "http://localhost:3000/api/analyze"

Write-Host "🧪 Testing CodeAtlas Backend API - RDS Repository" -ForegroundColor Cyan
Write-Host "📦 Repository: $repoUrl" -ForegroundColor Yellow
Write-Host "🔗 API endpoint: $apiUrl" -ForegroundColor Yellow
Write-Host ""

$body = @{
    repoUrl = $repoUrl
    provider = "ollama"
} | ConvertTo-Json

Write-Host "⏳ Sending request (this may take a few minutes)..." -ForegroundColor Yellow
$startTime = Get-Date

try {
    $response = Invoke-WebRequest -Uri $apiUrl -Method POST -Body $body -ContentType "application/json" -TimeoutSec 300
    
    $duration = (Get-Date) - $startTime
    Write-Host "✅ Response received ($([math]::Round($duration.TotalSeconds))s)" -ForegroundColor Green
    Write-Host ""
    
    $data = $response.Content | ConvertFrom-Json
    
    Write-Host "📊 Response Structure:" -ForegroundColor Cyan
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   Modules: $($data.modules.Count)" -ForegroundColor Green
    Write-Host "   Relationships: $($data.relationships.Count)" -ForegroundColor Green
    Write-Host "   Layers: $($data.layers.Count)" -ForegroundColor Green
    
    $hasPattern = if ($data.pattern) { "✅" } else { "❌" }
    $patternColor = if ($data.pattern) { "Green" } else { "Red" }
    Write-Host "   Has Pattern: $hasPattern" -ForegroundColor $patternColor
    
    $hasDiagram = if ($data.diagram) { "✅" } else { "❌" }
    $diagramColor = if ($data.diagram) { "Green" } else { "Red" }
    Write-Host "   Has Diagram: $hasDiagram" -ForegroundColor $diagramColor
    
    if ($data.diagram) {
        Write-Host "   Diagram Length: $($data.diagram.Length) chars" -ForegroundColor Green
    }
    Write-Host ""
    
    if ($data.pattern) {
        Write-Host "🏗️  Architectural Pattern:" -ForegroundColor Cyan
        Write-Host "   Name: $($data.pattern.name)" -ForegroundColor Yellow
        Write-Host "   Confidence: $([math]::Round($data.pattern.confidence * 100))%" -ForegroundColor Yellow
        Write-Host "   Description: $($data.pattern.description)" -ForegroundColor Yellow
        Write-Host ""
    }
    
    if ($data.summary) {
        Write-Host "📄 Summary (first 200 chars):" -ForegroundColor Cyan
        $summaryPreview = $data.summary.Substring(0, [Math]::Min(200, $data.summary.Length))
        Write-Host "   $summaryPreview..." -ForegroundColor White
        Write-Host ""
    }
    
    if ($data.modules -and $data.modules.Count -gt 0) {
        Write-Host "📝 Sample Modules (first 5):" -ForegroundColor Cyan
        $data.modules | Select-Object -First 5 | ForEach-Object {
            Write-Host "   - $($_.name) ($($_.type)) - $($_.path)" -ForegroundColor White
        }
        Write-Host ""
    }
    
    if ($data.diagram) {
        Write-Host "📐 Diagram Preview (first 200 chars):" -ForegroundColor Cyan
        $diagramPreview = $data.diagram.Substring(0, [Math]::Min(200, $data.diagram.Length))
        Write-Host $diagramPreview -ForegroundColor White
        Write-Host "..."
        Write-Host ""
    }
    
    if ($data.parsingWarnings -and $data.parsingWarnings.Count -gt 0) {
        Write-Host "⚠️  Parsing Warnings:" -ForegroundColor Yellow
        $data.parsingWarnings | ForEach-Object {
            Write-Host "   $_" -ForegroundColor Yellow
        }
        Write-Host ""
    }
    
    if ($data.error) {
        Write-Host "❌ Error: $($data.error)" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ All tests passed! Backend is working correctly." -ForegroundColor Green
    
} catch {
    Write-Host "❌ Test failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
    exit 1
}
