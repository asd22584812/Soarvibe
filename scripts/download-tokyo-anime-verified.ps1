# Verified Tokyo Anime assets only — run offline; runtime uses local paths.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$tokyo = Join-Path $root 'assets\city-journal\tokyo'
$base = Join-Path $root 'assets\city-journal'
New-Item -ItemType Directory -Force -Path $tokyo | Out-Null
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

function Save-Image($dest, $url) {
    Write-Host "Downloading $(Split-Path $dest -Leaf) ..."
    curl.exe -L -A $ua $url -o $dest
}

# Neutral editorial placeholder (not globe / not city-specific)
Save-Image (Join-Path $base 'placeholder-city-journal.jpg') 'https://images.pexels.com/photos/1571468/pexels-photo-1571468.jpeg?auto=compress&cs=tinysrgb&w=1200'

Save-Image (Join-Path $tokyo 'tokyo-hero.jpg') 'https://images.pexels.com/photos/3408354/pexels-photo-3408354.jpeg?auto=compress&cs=tinysrgb&w=1600'
Save-Image (Join-Path $tokyo 'tokyo-anime-hero.jpg') 'https://images.pexels.com/photos/32433838/pexels-photo-32433838.jpeg?auto=compress&cs=tinysrgb&w=1600'
Save-Image (Join-Path $tokyo 'tokyo-anime-cover.jpg') 'https://images.pexels.com/photos/6837428/pexels-photo-6837428.jpeg?auto=compress&cs=tinysrgb&w=1200'
Save-Image (Join-Path $tokyo 'akihabara-electric-town.jpg') 'https://images.pexels.com/photos/6837428/pexels-photo-6837428.jpeg?auto=compress&cs=tinysrgb&w=1600'
Save-Image (Join-Path $tokyo 'nakano-broadway.jpg') 'https://images.pexels.com/photos/6335077/pexels-photo-6335077.jpeg?auto=compress&cs=tinysrgb&w=1600'
Save-Image (Join-Path $tokyo 'gachapon-hall.jpg') 'https://images.pexels.com/photos/4116223/pexels-photo-4116223.jpeg?auto=compress&cs=tinysrgb&w=1600'
Save-Image (Join-Path $tokyo 'ichiran-ramen.jpg') 'https://images.pexels.com/photos/884600/pexels-photo-884600.jpeg?auto=compress&cs=tinysrgb&w=1600'
Save-Image (Join-Path $tokyo 'maid-cafe.jpg') 'https://images.pexels.com/photos/1024353/pexels-photo-1024353.jpeg?auto=compress&cs=tinysrgb&w=1600'
Save-Image (Join-Path $tokyo 'japanese-curry.jpg') 'https://images.pexels.com/photos/2471171/pexels-photo-2471171.jpeg?auto=compress&cs=tinysrgb&w=1600'
Save-Image (Join-Path $tokyo 'hotel-gracery.jpg') 'https://images.pexels.com/photos/189296/pexels-photo-189296.jpeg?auto=compress&cs=tinysrgb&w=1600'

Write-Host 'Done — Tokyo Anime verified set only.'
