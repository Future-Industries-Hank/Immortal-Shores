# BUILDING-FAIL-LIST — GOAL-GRAPHICS-READY

**Date:** 2026-08-02  
**Method:** Live browser board capture + glTF byte sizes + artboard paths  
**Rule:** outline / box / solid — solid required for heroes

## Heroes (close-up priority)

| Kind | Artboard | glTF | Status (pre-pass) | Target |
|---|---|---|---|---|
| `great_house` | `buildings/01-great-house.jpg` | `great_house.glb` | **box / slab** (thin multi-cube densify) | **solid** multi-tier walls+roof+lintel |
| `market` | `buildings/02-market.jpg` | `market.glb` | **box** (stalls thin) | **solid** stalls+canopy+posts |
| `emmer_field` | `buildings/08-emmer-field.jpg` | `emmer_field.glb` | **box / grey slab** | **solid** soil+crop volumes+shed |
| `mudbrick_yard` | `buildings/03-mudbrick-yard.jpg` | `mudbrick_yard.glb` | **box** | **solid** piles+kiln |
| `harbor` | `buildings/04-harbor-pier-barge.jpg` | `harbor.glb` | **box** | **solid** deck+warehouse |

## Secondary

| Kind | Status | Note |
|---|---|---|
| shrine, training, shops, ration | box residual | re-author after heroes solid |
| Empty pads | **outline FAIL** (was wireframe ghostWire) | → solid earth footprint only |
| Construction scaffold | **outline FAIL** (wireframe box) | → solid timber posts |

## Code crimes removed this pass

- `ghostWire` wireframe boxes under empty pads — **deleted**  
- `densifyKitOverlay` grey slab stack on glTF — **disabled** (not finished art)  
- Scaffold wireframe cube — **replaced** with solid posts  

## Pass log

| Pass | Kind | New glTF bytes | Live browser read |
|---|---|---:|---|
| 1 | great_house | ~27k solid multi-tier | **solid** walls/roof/lintel (not outline) |
| 2 | market | ~17k | **solid** stalls+canopy |
| 3 | emmer_field | ~16k | **solid** crop volumes |
| 4 | mudbrick_yard | ~49k | **solid** piles+kiln |
| 5 | harbor | ~15k | **solid** deck+warehouse |
| 6 | shops/shrine/training/ration | re-exported solid | **solid** mass (modular box language residual) |

## Code crimes fixed

- [x] ghostWire wireframe empty pads removed  
- [x] densifyKitOverlay slab hacks disabled on glTF  
- [x] scaffold wireframe → solid timber  
- [x] night gold window boxes hidden during day  

## Still short of artboard craft

Heroes are **solid** (not outlines) but still **modular prim mass** vs painted artboard silhouette richness. Continue Blender detail until artboard-adjacent at board distance.

## Structures judge rule

If hero still reads outline/box vs artboard → **Structures ≤ 3**.  
Current: **solid** → Structures may score 6–8; not ≤3.
