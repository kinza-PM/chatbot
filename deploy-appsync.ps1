param(
    [string]$Environment = "dev",
    [string]$Region = "eu-west-1"
)

Write-Host "Deploying AppSync Stack for $Environment environment..." -ForegroundColor Green

try {
    $awsVersion = aws --version 2>&1
    Write-Host "AWS CLI found: $awsVersion" -ForegroundColor Green
} catch {
    Write-Host "AWS CLI not found. Please install AWS CLI v2." -ForegroundColor Red
    exit 1
}

$stackName = "support-chat-appsync-$Environment"
Write-Host "Creating CloudFormation stack: $stackName" -ForegroundColor Cyan

aws cloudformation create-stack --stack-name $stackName --template-body file://appsync-config.yaml --parameters ParameterKey=Environment,ParameterValue=$Environment --region $Region

Write-Host "Waiting for stack creation to complete (this may take 2-3 minutes)..." -ForegroundColor Cyan
aws cloudformation wait stack-create-complete --stack-name $stackName --region $Region 2>&1 | Out-Null

Write-Host "Retrieving AppSync credentials..." -ForegroundColor Cyan
$outputs = aws cloudformation describe-stacks --stack-name $stackName --query "Stacks[0].Outputs" --region $Region | ConvertFrom-Json

if ($null -eq $outputs) {
    Write-Host "Failed to retrieve stack outputs. Stack may not exist." -ForegroundColor Red
    exit 1
}

$endpoint = $null
$apiKey = $null

foreach ($output in $outputs) {
    if ($output.OutputKey -eq "GraphQLApiEndpoint") {
        $endpoint = $output.OutputValue
    }
    if ($output.OutputKey -eq "GraphQLApiKey") {
        $apiKey = $output.OutputValue
    }
}

if ($null -eq $endpoint -or $null -eq $apiKey) {
    Write-Host "Could not find AppSync credentials in stack outputs." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================"
Write-Host "AppSync Deployment Successful!"
Write-Host "========================================"
Write-Host ""
Write-Host "AppSync Endpoint:" -ForegroundColor Cyan
Write-Host $endpoint -ForegroundColor Yellow
Write-Host ""
Write-Host "AppSync API Key:" -ForegroundColor Cyan
Write-Host $apiKey -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================"
Write-Host ""

$envContent = "VITE_APPSYNC_ENDPOINT=$endpoint`nVITE_APPSYNC_API_KEY=$apiKey`nVITE_CHATBOT_API_BASE=https://roj8jj0e3h.execute-api.eu-west-1.amazonaws.com/dev"

$adminPanelEnvPath = "..\Al-Rais-Admin-Panel\.env.local"
Write-Host "Saving credentials to $adminPanelEnvPath..." -ForegroundColor Cyan

$envContent | Out-File -FilePath $adminPanelEnvPath -Encoding UTF8 -Force

Write-Host "Credentials saved to .env.local" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Go to Al-Rais-Admin-Panel directory"
Write-Host "2. Run: npm install"
Write-Host "3. Run: npm run dev"
Write-Host ""
