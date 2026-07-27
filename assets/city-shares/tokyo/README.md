# Tokyo city share images (Phase 1A.5)

Verified packages are tracked in `verified-manifest.json`.

## Download verified assets

```bash
node scripts/fetch-city-shares-verified-images.mjs
```

Sources: Wikimedia Commons only (CC / CC0). No Google Places, no Unsplash proxy.

## Naming

`{postId}-{slot}-{index}.jpg`

## Pending (awaiting verified source)

- `tokyo-ramen-afuri-ebisu-001` — need AFURI 恵比寿 **exterior or entrance**
- `tokyo-lodging-mimaru-ueno-001` — need MIMARU 上野イースト **exterior or entrance** (first image)

Drop verified files here, update `verified-manifest.json` + `city-shares-data.js`, then re-run:

```bash
node scripts/validate-city-shares.mjs
```
