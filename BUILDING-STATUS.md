# BUILDING-STATUS — FULL VISUAL OVERHAUL

**Date:** 2026-08-03 · Audit: 5-agent parallel sweep (kits/terrain/life/UI/map)
**Rule:** every kind must be solid, artboard-adjacent, material-rich (no flat MS-Paint faces)

## Kits

| Kind | Artboard anchor | State (audit) | Action |
|---|---|---|---|
| great_house | 01 | re-authored 08-02, quality bar | vcol/material richness pass |
| market | 02 | re-authored | richness pass |
| emmer_field | 08 | re-authored | richness pass |
| mudbrick_yard | 03 | re-authored | richness pass |
| harbor | 04 | re-authored | richness pass |
| river_clay_pit | 03 (earth/clay family) | re-authored | richness pass |
| marsh_reed_bed | 08 (berm language) | re-authored | richness pass |
| **training_grounds** | **05** | **CRITICAL — old box kit** | Blender author (yard + targets + dummies + shade) |
| **shrine** | **06** | **CRITICAL — old box kit** | Blender author (06 silhouette) |
| **ration_house** | **09** | **CRITICAL — old box kit** | Blender author (09) |
| **luxury_material** | **07** (raw side) | **CRITICAL — old box kit** | Blender author (stone/ingot yard) |
| **luxury_workshop** | **07** (craft side) | **CRITICAL — old box kit** | Blender author (benches, awning, goods) |
| **vessel_shop** | 03 kiln + 02 shopfront | **CRITICAL — old box kit** | Blender author (amphora racks hero prop) |
| **reed_basket_shop** | 02 shopfront + 08 reed | **CRITICAL — old box kit** | Blender author (basket stacks hero prop) |
| **warehouse** | 04 warehouse mass | **CRITICAL — old box kit** | Blender author (no pier) |
| barge.glb | 04 | unused by kitLoader | delete file; barges are scene.ts procedural |

## Environment (owner complaint: "tan flat plane, no natural features")

| Surface | Finding | Action |
|---|---|---|
| Ground | zero relief, micro-noise texture only | vertex displacement outside gameplay rect + macro tonal texture layer |
| Open desert | zero props east of settlement | palm clusters, scrub tuft ring, sandstone outcrops, crescent dune ridges |
| Falloff planes | 3 stacked translucent washes | delete farCarpet/farWash/heat plane; depth via macro texture + scene fog |
| River shoreline | straight parallel stripe boxes | bent shoreline ribbons + mudflat lobes; foam into water, silt-grey |
| Shore rocks | mechanical line | 3 clusters, size/tilt variance, partial burial |
| Camera | too zoomed out at r48 | **DONE r34** fixed (no wheel) |

## Life

| Surface | Finding | Action |
|---|---|---|
| Workers | emissive flat mats, fused legs | sun-lit mats, A-stance legs, headcloth, kilt variety, tiny board scale |
| Pads | translucent butter slabs | solid packed-sand plinth + carved-stone category token |
| Ghost foundation | solid block | low hollow perimeter foundation courses |
| Scaffold | wire-ish | real timber posts + ledgers + diagonals |
| Night windows | hard toggle | smoothstep fade + flicker variance |
