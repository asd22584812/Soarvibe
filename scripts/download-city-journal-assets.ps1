# City Journal asset downloader — asset collection only (not used at runtime).
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$base = Join-Path $root 'assets\city-journal'
$tokyo = Join-Path $base 'tokyo'
New-Item -ItemType Directory -Force -Path $tokyo | Out-Null

$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

function Save-Image($rel, $url) {
    $dest = Join-Path $base $rel
    $dir = Split-Path -Parent $dest
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    if ((Test-Path $dest) -and ((Get-Item $dest).Length -gt 10000)) {
        Write-Host "Skip existing $rel"
        return
    }
    Write-Host "Downloading $rel ..."
    try {
        Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing -UserAgent $ua -TimeoutSec 60
    } catch {
        Write-Warning "Failed $rel : $_"
    }
}

$downloads = @{
    'placeholder-city-journal.jpg' = 'https://images.pexels.com/photos/346885/pexels-photo-346885.jpeg?auto=compress&cs=tinysrgb&w=1200'
    'tokyo\tokyo-hero.jpg' = 'https://images.pexels.com/photos/3408354/pexels-photo-3408354.jpeg?auto=compress&cs=tinysrgb&w=1600'
    'tokyo\tokyo-budget-cover.jpg' = 'https://images.pexels.com/photos/460672/pexels-photo-460672.jpeg?auto=compress&cs=tinysrgb&w=800'
    'tokyo\tokyo-sightseeing-cover.jpg' = 'https://images.pexels.com/photos/402028/pexels-photo-402028.jpeg?auto=compress&cs=tinysrgb&w=800'
    'tokyo\tokyo-trendy-cover.jpg' = 'https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=800'
    'tokyo\tokyo-food-cover.jpg' = 'https://images.pexels.com/photos/248444/pexels-photo-248444.jpeg?auto=compress&cs=tinysrgb&w=800'
    'tokyo\tokyo-instagram-cover.jpg' = 'https://images.pexels.com/photos/161963/tokyo-tower-japan-lights-night-161963.jpeg?auto=compress&cs=tinysrgb&w=800'
    'tokyo\tokyo-anime-cover.jpg' = 'https://images.pexels.com/photos/6837428/pexels-photo-6837428.jpeg?auto=compress&cs=tinysrgb&w=800'
    'tokyo\tokyo-streetwear-cover.jpg' = 'https://images.pexels.com/photos/336372/pexels-photo-336372.jpeg?auto=compress&cs=tinysrgb&w=800'
    'tokyo\tokyo-anime-hero.jpg' = 'https://images.pexels.com/photos/32433838/pexels-photo-32433838.jpeg?auto=compress&cs=tinysrgb&w=1600'
    'tokyo\akihabara-electric-town.jpg' = 'https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=1600'
    'tokyo\nakano-broadway.jpg' = 'https://images.pexels.com/photos/6335077/pexels-photo-6335077.jpeg?auto=compress&cs=tinysrgb&w=1600'
    'tokyo\gachapon-hall.jpg' = 'https://images.pexels.com/photos/4116223/pexels-photo-4116223.jpeg?auto=compress&cs=tinysrgb&w=1600'
    'tokyo\ichiran-ramen.jpg' = 'https://images.pexels.com/photos/884600/pexels-photo-884600.jpeg?auto=compress&cs=tinysrgb&w=1600'
    'tokyo\maid-cafe.jpg' = 'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=1600'
    'tokyo\japanese-curry.jpg' = 'https://images.pexels.com/photos/2471171/pexels-photo-2471171.jpeg?auto=compress&cs=tinysrgb&w=1600'
    'tokyo\hotel-gracery.jpg' = 'https://images.pexels.com/photos/189296/pexels-photo-189296.jpeg?auto=compress&cs=tinysrgb&w=1600'
    'tokyo\hostel-nui.jpg' = 'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg?auto=compress&cs=tinysrgb&w=1600'
}

foreach ($rel in $downloads.Keys) { Save-Image $rel $downloads[$rel] }

$cityHeroMap = @{
    'osaka' = 'osaka.jpg'
    'kyoto' = 'kyoto.jpg'
    'seoul' = 'seoul.jpg'
    'paris' = 'paris.jpg'
    'london' = 'london.jpg'
    'bangkok' = 'bangkok.jpg'
    'hokkaido' = 'hokkaido.jpg'
}
foreach ($city in $cityHeroMap.Keys) {
    $cityDir = Join-Path $base $city
    New-Item -ItemType Directory -Force -Path $cityDir | Out-Null
    $src = Join-Path $root "cover-photos\$($cityHeroMap[$city])"
    $dest = Join-Path $cityDir "$city-hero.jpg"
    if (Test-Path $src) { Copy-Item $src $dest -Force; Write-Host "Copied hero $city" }
}

# Edition cover placeholders for other cities (distinct files per edition from cover pool)
$coverPool = @('osaka.jpg','kyoto.jpg','seoul.jpg','paris.jpg','london.jpg','bangkok.jpg','hokkaido.jpg','tokyo.jpg')
$editionSuffix = @('budget','sightseeing','trendy','food','instagram','anime','streetwear')
foreach ($city in @('osaka','kyoto','seoul','paris','london','bangkok','hokkaido')) {
    $cityDir = Join-Path $base $city
    New-Item -ItemType Directory -Force -Path $cityDir | Out-Null
    for ($i = 0; $i -lt $editionSuffix.Count; $i++) {
        $suffix = $editionSuffix[$i]
        $poolFile = $coverPool[$i % $coverPool.Count]
        $src = Join-Path $root "cover-photos\$poolFile"
        $dest = Join-Path $cityDir "$city-$suffix-cover.jpg"
        if ((Test-Path $src) -and -not (Test-Path $dest)) {
            Copy-Item $src $dest -Force
        }
    }
}

Write-Host 'Done.'
