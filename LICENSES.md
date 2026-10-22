# Third-party assets: Eternal Valley (ev-proto2, box prototype)

| Asset | File(s) in repo | Source URL | Author | License | Retrieved | Notes |
|---|---|---|---|---|---|---|
| HDRI "Table Mountain 2" | `images/textures/table_mountain_2_2k_env.hdr` (v35; v36 ships the 1k derivative, see below) (from `table_mountain_2_2k.hdr`, md5 b4b025c778f44c1b467a7839f45a6c94), `images/textures/table_mountain_2_4k_bg.hdr` (from `table_mountain_2_4k.hdr`, md5 f43b90798994b71586e7e895444bfa2b) | https://polyhaven.com/a/table_mountain_2 (files: https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/table_mountain_2_2k.hdr, .../4k/table_mountain_2_4k.hdr) | Greg Zaal (HDRI), Rico Cilliers (backplates) | CC0 1.0 (https://polyhaven.com/license) | 2026-10-02 | Free download, no purchase. Derivatives made on the box: sun disc clamped (env: luminance cap 8 within 5 deg of the sun; bg: cap 40 within 3 deg) so only the DirectionalLight carries the sun. Script: /workspace/photoreal/hdri_src/make_derivs.py. Optional credit: "HDRI: Table Mountain 2 by Greg Zaal, Poly Haven (CC0)". |
| HDRI "Meadow 2" (1k) | `images/textures/meadow_2k.hdr` (pre-existing, now unused) | https://polyhaven.com/a/meadow_2 | Sergej Majboroda | CC0 1.0 | pre-existing (provenance by md5 7deac04bbf250f12a4daf1afaa6cab5f, Scanned Asset Sourcer 2026-09-29) | Not loaded since lighting pass 2; can be deleted from the bundle. |

## Terrain scan textures (v34 / EVR-02)

Shipped under `images/terrain/scan/` as JPEG albedo / nrh / orm (derived from 2K CC0 photoscans). Full source notes: terrain-vegetation-realism inbox `LICENSES_terrain_scan.md`.

| Layer (repo name) | Source | Author / site | License |
|---|---|---|---|
| granite_* | Poly Haven [rock_boulder_dry](https://polyhaven.com/a/rock_boulder_dry) | Poly Haven | CC0 1.0 |
| sandstone_* | Poly Haven [cliff_side](https://polyhaven.com/a/cliff_side) | Poly Haven | CC0 1.0 |
| beachSand_* | ambientCG [Ground080](https://ambientcg.com/view?id=Ground080) | ambientCG | CC0 1.0 |
| meadow_* | ambientCG [Ground037](https://ambientcg.com/view?id=Ground037) | ambientCG | CC0 1.0 |
| forestFloor_* | Poly Haven [forest_ground_04](https://polyhaven.com/a/forest_ground_04) | Poly Haven | CC0 1.0 |
| snow_* | Poly Haven [snow_02](https://polyhaven.com/a/snow_02) | Poly Haven | CC0 1.0 |
| wetPebbles_* | Poly Haven [ganges_river_pebbles](https://polyhaven.com/a/ganges_river_pebbles) | Poly Haven | CC0 1.0 |
| desertSand_* | Poly Haven [red_sand](https://polyhaven.com/a/red_sand) | Poly Haven | CC0 1.0 |

Optional credit: "Terrain photoscans: Poly Haven & ambientCG (CC0)".


| images/backdrop/ev_sky_*.webp | Original render by JOTS.MEDIA (Blender 5.2.2 Cycles, 2026-10-07) from the CC0 Table Mountain 2 HDRI (Greg Zaal, Poly Haven) and the CC0 Poly Haven scanned textures listed above | Blender is GPL software; renders are owned by the creator | No third-party restrictions |


## Near-field scans (v36 / EVR-04)
All from Poly Haven, CC0 1.0 (https://polyhaven.com/license), free downloads, retrieved 2026-10-07 via https://api.polyhaven.com. Shipped files are derivatives (Blender impostor bakes, decimated meshes, resized/KTX2-encoded maps) under `images/nearfield/`.

| Asset | Poly Haven page | Author(s) | Used as | Repo files |
|---|---|---|---|---|
| Fir Tree 01 | https://polyhaven.com/a/fir_tree_01 | Rob Tuytel (photography), Rico Cilliers (modeling) | pine / mountain pine / cypress impostors | tree_fir_* |
| Island Tree 01 | https://polyhaven.com/a/island_tree_01 | Rob Tuytel, Rico Cilliers | oak / golden oak impostors | tree_broadleaf_* |
| Tree Small 02 | https://polyhaven.com/a/tree_small_02 | Rico Cilliers | sakura (blossom tint) / willow impostors | tree_smallleaf_* |
| Jacaranda Tree | https://polyhaven.com/a/jacaranda_tree | Rico Cilliers (Rob Tuytel guidance) | mountain broadleaf impostors | tree_blossom_* |
| Namaqualand Boulder 02 | https://polyhaven.com/a/namaqualand_boulder_02 | Greg Zaal (photography), Rico Cilliers (modeling) | boulders, cairns, tarn rocks | rock_namaqualand_boulder_02_lod*.glb, rock_namaqualand_* |
| Rock 07 | https://polyhaven.com/a/rock_07 | Jenelle van Heerden | meadow stones | rock_rock_07_lod*.glb, rock_07_* |
| Cobblestone Floor 01 | https://polyhaven.com/a/cobblestone_floor_01 | Rob Tuytel | gate terrace + road sub-base | cobble_* |
| Mossy Rock | https://polyhaven.com/a/mossy_rock | Rob Tuytel | coastal cliff / sea stacks | mossrock_* |

| Derived | Notes |
|---|---|
| cloud_0..3 (.ktx2/.webp) | Original Blender 5.2.2 Cycles volumetric renders by JOTS.MEDIA (no third-party content). |
| images/textures/table_mountain_2_1k_env.hdr | 1k downscale of the existing CC0 Table Mountain 2 env derivative (Greg Zaal, Poly Haven); replaces the 2k file in v36. |
| Tools | Blender 5.2.2 (GPL, tool only), basisu 2.50 (Apache-2.0, tool only), gltf-transform (MIT, tool only). meshopt decoder + KTX2/basis transcoder already shipped with three.js (MIT). |

Optional credit: "Trees, rocks, cobbles: Poly Haven scans (CC0)".

- v36 tuning: fir_tree_01 (Poly Haven, CC0) atlas rebaked as single-tree crop; no new assets added.

## v36 drop 1 additions
| Asset | File(s) | Source | Author | Licence | Notes |
|---|---|---|---|---|---|
| Grass card "grass_medium_02" | `images/grass/grass_medium_02_v0.png` | https://polyhaven.com/a/grass_medium_02 | Poly Haven | CC0 1.0 | Free download. Baked to an alpha card in Blender 5.2.2 (blender_src/bakes_grass, grass_meta.json). |
| Mist and cloud textures | generated at runtime (canvas) | own procedural code | - | - | No external asset. |

---

# v37 additions (merged Oct 20 2026; all CC0 / original work / tool-only GPL, $0)

## From inbox/pbr-EVR-07/LICENSES.md

### pbr-EVR-07 LICENSES (all CC0 1.0, no attribution required; courtesy credit given)
| Asset | Type | Source URL | Author | License | Attribution | Date retrieved | Where used |
|---|---|---|---|---|---|---|---|
| Sandstone Blocks 05 | PBR scan texture set | https://polyhaven.com/a/sandstone_blocks_05 | Rob Tuytel | CC0 1.0 | Not required; "Sandstone Blocks 05 by Rob Tuytel, Poly Haven (CC0)" | 2026-09-29 | lib_cathedral_sandstone (cathedral) |
| Hinoki Planks | PBR scan texture set | https://polyhaven.com/a/hinoki_planks | Charlotte Baglioni | CC0 1.0 | Not required; "Hinoki Planks by Charlotte Baglioni, Poly Haven (CC0)" | 2026-10-17 | lib_pagoda_timber_tan (pagoda walls/timber) |
| Roof Tiles 14 | PBR scan texture set | https://polyhaven.com/a/roof_tiles_14 | Rob Tuytel | CC0 1.0 | Not required; "Roof Tiles 14 by Rob Tuytel, Poly Haven (CC0)" | 2026-10-17 | lib_pagoda_roof_tile_greygreen (pagoda roofs) |
| Granite 002 A | PBR texture set | https://ambientcg.com/view?id=Granite002A | Lennart Demes | CC0 1.0 | Not required; "Granite 002 A by Lennart Demes, ambientCG (CC0)" | 2026-09-29 | lib_granite (crag/foundations, steles) |
| Marble 012 | PBR texture set | https://ambientcg.com/view?id=Marble012 | Lennart Demes | CC0 1.0 | Not required; "Marble 012 by Lennart Demes, ambientCG (CC0)" | 2026-09-29 | lib_marble_polished (polished/honed marble) |
| Cobblestone Square | PBR scan texture set | https://polyhaven.com/a/cobblestone_square | Rob Tuytel | CC0 1.0 | Not required; "Cobblestone Square by Rob Tuytel, Poly Haven (CC0)" | 2026-10-17 | lib_cobble (roads/paths) |
| Rectangular Paving | PBR scan texture set | https://polyhaven.com/a/rectangular_paving | Dimitrios Savva | CC0 1.0 | Not required; "Rectangular Paving by Dimitrios Savva, Poly Haven (CC0)" | 2026-10-17 | lib_plaza_stone + lib_plaza_detail_mask R channel (central plaza) |
| Bark Brown 02 | PBR scan texture set | https://polyhaven.com/a/bark_brown_02 | Rob Tuytel | CC0 1.0 | Not required; "Bark Brown 02 by Rob Tuytel, Poly Haven (CC0)" | 2026-10-17 | lib_bark (Tree of Life, trunks) |
| plaza_detail_mask G/B | Procedural (own work) | n/a | JOTS.MEDIA PBR Materials Artist | Own work | n/a | 2026-10-17 | lib_plaza_detail_mask |

## From inbox/pbr-EVR-08/LICENSES.md

### pbr-EVR-08 LICENSES (all CC0 1.0; attribution not required, courtesy credit given)
| Asset | Type | Source URL | Author | License | Attribution | Date retrieved | Where used |
|---|---|---|---|---|---|---|---|
| Sandstone Blocks 05 (4K) | PBR scan texture set | https://polyhaven.com/a/sandstone_blocks_05 | Rob Tuytel | CC0 1.0 | Not required; "Sandstone Blocks 05 by Rob Tuytel, Poly Haven (CC0)" | 2026-10-19 | lib_cathedral_sandstone (EVR-08 tiers) |
| Rock 028 (4K) | PBR texture set | https://ambientcg.com/view?id=Rock028 | Lennart Demes (ambientCG) | CC0 1.0 | Not required; "Rock 028, ambientCG (CC0)" | 2026-10-19 | lib_granite (cirque, crag, foundations) |
| Rocky Trail (4K) | PBR scan texture set | https://polyhaven.com/a/rocky_trail | Amal Kumar | CC0 1.0 | Not required; "Rocky Trail by Amal Kumar, Poly Haven (CC0)" | 2026-10-19 | lib_scree (talus/scree) |
| Forest Ground 04 (4K) | PBR scan texture set | https://polyhaven.com/a/forest_ground_04 | Rob Tuytel (photo/processing), Rico Cilliers (adjustment) | CC0 1.0 | Not required; "Forest Ground 04 by Rob Tuytel, Poly Haven (CC0)" | 2026-10-19 | lib_ground (meadow soil) |
| Moss 002 (4K) | PBR texture set | https://ambientcg.com/view?id=Moss002 | Lennart Demes (ambientCG) | CC0 1.0 | Not required; "Moss 002, ambientCG (CC0)" | 2026-10-19 | lib_moss |
| Cobblestone Square (4K) | PBR scan texture set | https://polyhaven.com/a/cobblestone_square | Rob Tuytel | CC0 1.0 | Not required; "Cobblestone Square by Rob Tuytel, Poly Haven (CC0)" | 2026-10-19 | lib_cobble (EVR-08 tiers) |
| Ehingen Hillside | HDRI (4K/2K/1K .hdr) | https://polyhaven.com/a/ehingen_hillside | Andreas Mischok | CC0 1.0 | Not required; "Ehingen Hillside by Andreas Mischok, Poly Haven (CC0)" | 2026-10-19 | IBL/background candidate (A/B vs table_mountain_2) |

## From inbox/terrain-EVR-05/LICENSES.md

### EVR-05 terrain: licences

| Item | Files | Source | Licence | Notes |
|---|---|---|---|---|
| Master heightfield, masks, tiles, sky lightmap, AO | `heightmap/*`, `masks/*`, `models/terrain_evr05/*`, `textures/*`, `runtime_data/*`, `src_masters/*` | Original procedural work (JOTS.MEDIA), authored in numpy + Blender 5.2.2 from the v36/EVR-04 layout fields (`build_terrain.py` lineage) | Owned by the creator | No third-party data. The lightmap is baked from the HDRI below. |
| Canyon arch mesh | `models/arch/ev_canyon_arch_LODs.glb` | Original procedural Blender model (boolean + voxel remesh + noise erosion) | Owned by the creator | No textures embedded. |
| Sky HDRI used for the bake, gray card and look-dev renders | `table_mountain_2_1k_env.hdr` (md5 1f3e3977f7110ff2abf6ccb3140aa56a, the same file v36 ships; not redistributed here) | Poly Haven "Table Mountain 2", Greg Zaal | CC0 1.0 | Per BAKE_STANDARD §0. |
| Comparison renders | `renders/*` | Blender 5.2.2 Cycles renders (box) of the above | Owned by the creator | Render-only use of the CC0 scans below. |
| Render-only terrain scans | `/workspace/ev-versions/v36/images/terrain/scan/*_albedo.jpg` (not redistributed) | granite: Poly Haven rock_boulder_dry · sandstone: Poly Haven cliff_side · beachSand: ambientCG Ground080 · meadow: ambientCG Ground037 · forestFloor: Poly Haven forest_ground_04 · desertSand: Poly Haven red_sand | CC0 1.0 | Same files and provenance as v36 `LICENSES.md`. |
| Reference stills (left panel of the comparison sheets) | v36 / eternal-valley-restored / eternal-valley-local `images/photoreal/veo_*.jpg`, `eternal_valley_master_layout_map.jpg` | The project's own reference images | Project-owned | Side-by-side QC only. |
| Tools | meshoptimizer (MIT), gltf-transform (MIT), KTX-Software (Apache-2.0), three r186 (MIT, QC pages only), Blender 5.2.2 (GPL; outputs unrestricted), OpenEXR python (BSD-3, QC only), playwright-core (Apache-2.0, QC only) | — | — | Tooling only. Nothing is bundled except the loader JS in `runtime/`. |

No paid services, Marble or gaussian splats were used. No purchases.

## From inbox/terrain-EVR-05/scatter/LICENSES.md

### EVR-05 scatter — licenses

All third-party assets are **CC0 1.0** from Poly Haven (https://polyhaven.com/license). Nothing paid, nothing non-CC0. "Original" = built in Blender for this project by the EVR-05 pipeline (no third-party geometry).

| Shipped species | Source | License | Authors (Poly Haven credit) |
|---|---|---|---|
| fir_a | Original skeleton; needle cards + bark from Poly Haven *Pine Sapling Small* (https://polyhaven.com/a/pine_sapling_small) | CC0 1.0 + original | Rob Tuytel, Rico Cilliers |
| broadleaf_a | *Tree Small 02* (https://polyhaven.com/a/tree_small_02) | CC0 1.0 | Rico Cilliers |
| broadleaf_b | *Island Tree 02* (https://polyhaven.com/a/island_tree_02) | CC0 1.0 | Rob Tuytel, Rico Cilliers |
| willow_a | Original skeleton + painted strands; bark from *Tree Small 02* | CC0 1.0 + original | Rico Cilliers |
| red_maple_a | Original skeleton; leaf cards from *Tree Small 02* leaves, recoloured | CC0 1.0 + original | Rico Cilliers |
| cherry_a | Original skeleton; leaf cards from *Island Tree 02* leaves, recoloured | CC0 1.0 + original | Rob Tuytel, Rico Cilliers |
| shrub_a | *Shrub 02* (https://polyhaven.com/a/shrub_02) | CC0 1.0 | Rico Cilliers |
| fern_a | *Fern 02* (https://polyhaven.com/a/fern_02) | CC0 1.0 | Rob Tuytel, Rico Cilliers |
| desert_bush_a | *Wild Rooibos Bush* (https://polyhaven.com/a/wild_rooibos_bush) | CC0 1.0 | James Ray Cock, Jenelle van Heerden |
| quiver_a (impostor only) | *Quiver Tree 01* (https://polyhaven.com/a/quiver_tree_01) | CC0 1.0 | James Ray Cock, Dario Barresi, Rico Cilliers |
| rock_a | *Rock 07* (https://polyhaven.com/a/rock_07) | CC0 1.0 | Jenelle van Heerden |
| boulder_a | *Boulder 01* (https://polyhaven.com/a/boulder_01) | CC0 1.0 | Rico Cilliers |
| desert_boulder_a | *Namaqualand Boulder 04* (https://polyhaven.com/a/namaqualand_boulder_04) | CC0 1.0 | Jenelle van Heerden |

Built but **not shipped** (Lead option B, Oct 15): palm_a (fully original geometry and painted textures) and cypress_a (original skeleton, Pine Sapling Small cards). Both are CC0/original.
Downloaded for evaluation and not used in the shipped set (all CC0 1.0): fir_tree_01, jacaranda_tree, searsia_lucida, shrub_04, stone_01.
Impostors, texture arrays and lightmaps are derived renders of the assets above (same license).
Per-asset provenance JSON: `src/polyhaven/<asset>/source.json` in the work folder.

## From inbox/water-EVR-07/LICENSES.md

### EVR-07 licences
- evRainbow.js: original code (JOTS.MEDIA), no third-party assets.
- Rig only (not shipped): ev_sky_golden_2k.webp (EVR-05 own render), three r186 (MIT).
- Ref plates (refs/batch1, Grok Imagine): used as look targets only, not shipped.

## From inbox/water-EVR-05/sky/LICENSES.md

### EVR-05 sky backdrop: sources and licences
| File(s) | What | Source | Licence |
|---|---|---|---|
| `ev_sky_golden_{4k,2k}.{webp,ktx2}` | Original Cycles render by JOTS.MEDIA (Photoreal Lighting Lead), Blender 5.2 on John's Mac (Metal, 256 spp), rendered 2026-10-15; post on the box | Built from the items below. The sky is Blender's procedural physical sky (Multiple Scattering). | Owned by the creator. Blender is GPL (tool only; renders are not covered). |
| level reference (not shipped) | `table_mountain_2_1k_env.hdr`, the existing v36 IBL derivative of Poly Haven "Table Mountain 2" (Greg Zaal, Rico Cilliers) | https://polyhaven.com/a/table_mountain_2 | CC0 1.0 |
| mountain-ring textures (baked into the render) | v35 terrain scan set: granite, snow, forest floor, meadow (`src/tex/`, same files as v35 `blender_src/tex`) | per v36 LICENSES.md: Poly Haven rock_boulder_dry, snow_02, forest_ground_04; ambientCG Ground037 | CC0 1.0 |
| mountain-ring heights | v35 `ring_h.f32` (team-made heightfield) | JOTS.MEDIA | own work |
| tools | KTX-Software 4.4.2 / basisu (Apache-2.0), Pillow (HPND), numpy (BSD) | tools only | — |
No paid assets, no Marble, no splats, no AI imagery.

`src/` in this folder holds copies of the CC0 inputs above (v35 textures, ring heightfield, 1k env HDRI) so the Mac render is self-contained. Licences unchanged.
Preview `preview_vs_reference.png` places the render beside the reference still `veo_rainbow_bridge` from the client's EternalValley3D set (internal comparison only, not shipped).

## v37 soundscape

js/soundscape.js: Wind Chimes and solfeggio bells are synthesized at runtime with the Web Audio API (original code, no audio files).
## October 20, 2026 realism update

The files in `images/materials-4k/` are native 4096 × 4096 Poly Haven
photoscans, CC0 1.0: sandstone_blocks_05, rock_boulder_dry, forest_ground_04,
leafy_grass, marble_01, bark_brown_02, red_sand, cobblestone_square,
roof_tiles_14, and hinoki_planks. Authoritative source URLs and MD5 hashes
are in `images/materials-4k/manifest.json`. GPU-compressed KTX2 derivatives
retain the original dimensions and include mipmaps. The `1k/` directory is
an intentionally reduced mobile tier.

`images/hero-trees/` contains a derived mesh and nine native 4K maps from
[Poly Haven tree_small_02](https://polyhaven.com/a/tree_small_02), CC0 1.0.
Its processing, source, and limitations are recorded in `asset-info.json`.

`images/backdrop/table_mountain_2_photographic.jpg` is the 8192 × 4096
tonemapped panorama of [Table Mountain 2](https://polyhaven.com/a/table_mountain_2),
CC0 1.0. The 4K and 2K files are reduced device tiers.
[Poly Haven license](https://polyhaven.com/license).

`libs/three/examples/jsm/geometries/RoundedBoxGeometry.js` is from the official
Three.js r186 release and retains the project's MIT license.

`images/photographic/grand-gate.png` is AI-generated, not a real photograph.
See the accompanying README for provenance and its actual dimensions.

## October 22, 2026 volumetric forest LOD assets

`images/hero-trees/{broadleaf,fir,blossom}_{near,mid,far}.glb` are geometry-only,
meshopt-compressed derivatives of these Poly Haven CC0 1.0 sources:

- [tree_small_02](https://polyhaven.com/a/tree_small_02): broadleaf near/mid meshes,
  source-derived far canopy volumes, and the previously shipped detailed hero tree.
- [fir_tree_01](https://polyhaven.com/a/fir_tree_01): the `a` tree variant, native twig
  and wood meshes, source-derived far canopy volumes, and native 4096 × 4096 PBR maps.
- [jacaranda_tree](https://polyhaven.com/a/jacaranda_tree): leaf and wood meshes,
  source-derived far canopy volumes, and native 4096 × 4096 PBR maps. Pink blossom
  coloration is an artistic runtime tint, not the original scan's foliage color.

Near/mid LODs retain complete source leaf/twig components with density compensation;
far LODs use closed 3D canopy volumes fitted to the source foliage distribution and
reduced wood geometry. No complete-tree billboards are included in these GLBs.
The existing detailed `tree_small_02.glb` is preserved separately.

The `_rgba_4k.ktx2` maps pack source diffuse and source alpha channels. KTX2 encoding
uses Basis Universal ETC1S, quality 180, compression level 1, native 4096 × 4096 pixels,
and mipmaps; normal and ARM maps use linear transfer. Source/API references,
material mappings, normalized heights, and triangle counts are recorded in
`images/hero-trees/forest-lods.json`. The preparation script is
`tools/build_forest_lods.py`. [Poly Haven license](https://polyhaven.com/license).

The optional `*_farBotanical.glb` files retain a sparse selection of source leaf/twig
meshes arranged in their original 3D orientations, with area compensation. Their
alpha cutouts are botanical surfaces, never camera-facing complete-tree cards.
Jacaranda intermediate canopy limbs are reconstructed tapered meshes connecting
source-derived canopy clusters to the scanned trunk to avoid disconnected fragments
at the reduced triangle budget.


## Alpine elevation landforms (October 22, 2026)

`images/terrain/alpine/mont-blanc.u16` derives from Mapzen/Tilezen Terrain Tiles on AWS, accessed October 22, 2026. Exact source tile URLs, geographic extent, quantization and transformations are recorded in `images/terrain/alpine/source.json`; reproducible preparation is in `tools/build-alpine-dem.py`.

Europe terrain produced using Copernicus data and information funded by the European Union — EU-DEM layers. SRTM and GMTED2010 data courtesy of the U.S. Geological Survey.

Sources: https://registry.opendata.aws/terrain-tiles/ and https://github.com/tilezen/joerd/blob/master/docs/attribution.md . The Chamonix/Mont Blanc landforms are rotated, scaled, offset and blended into fictional sanctuary terrain. This is not a geographic representation or navigational dataset; the providers do not endorse these modifications.

### Gate inscription font
Optimer outline data from the official Three.js r186 font examples, originally Magenta OpenType. Redistribution notice: `js/realism/triumphalGateFont.LICENSE.txt`. Used to construct the extruded gate inscription.
