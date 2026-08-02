# PROMPT 02.9 — Director approval first, then craft

### Immortal Shores · Storyboard Yes/No → Standard view lock → presentation fix  
### Do not skip to fog/atmosphere polish

> **Order is mandatory.**  
> **Step 1:** Open the art board for the director.  
> **Step 2:** Show a **standard settlement view** (full board, few buildings + pads) so they confirm POV and building/people scale.  
> **Step 3:** Only after both approvals — implement craft (02.8 director play issues + structure honesty).  
> Economy / plots / trust-trade stay frozen.

---

## STEP 1 — Open the art storyboard (BLOCKING)

### What you do immediately

1. Pull latest `main`.  
2. Ensure boards exist under `docs/visual-inspiration/` (buildings + settlement money-shot).  
3. Serve or open for the director:

   **`ART-STORYBOARD-REVIEW.html`** (repo root)

   How to open (**use these exact URLs** — wrong path = 404):

   ```bash
   # PREFERRED — with npm run dev (Vite serves public/)
   # → http://127.0.0.1:5173/storyboard/
   # (apps/client/public/storyboard/index.html)

   # ALTERNATE — from repo root only:
   npm run storyboard
   # → http://127.0.0.1:8765/ART-STORYBOARD-REVIEW.html
   ```

   **404 traps:**  
   - `http://127.0.0.1:5173/ART-STORYBOARD-REVIEW.html` → **404** (file is not at Vite root)  
   - `http://127.0.0.1:8765/storyboard/` → **404** unless you cd into public  

4. **Tell the director in plain language:**  
   > “Open **http://127.0.0.1:5173/storyboard/** (with the game dev server running). For each image: **Yes** / **No** / **Revise**. Inspiration only — not final assets.”
5. **STOP and wait** for director decisions.  
   - Do **not** assume Yes.  
   - Do **not** start Blender/fog/worker rewrites until Step 1 is finished.  
   - On **Revise/No**: regenerate only those boards (image_gen), update paths, re-open review.  

6. When all **required** slots are **Yes**, write:

   **`ART-STORYBOARD-APPROVED.md`**

   Include date, list of approved paths, and any director notes.  
   Set `art_storyboard_approved: true` in `ai_manifest.json` if present.

---

## STEP 2 — Standard view (POV + scale lock) — BLOCKING

Director needs one **canonical in-game frame** to approve perspective and scale — not a zoomed people-closeup.

### Build a temporary “approval mode” settlement view

Implement quickly (can be a debug flag `?board=1` or always-on settlement framing for this pass):

| Rule | Spec |
|---|---|
| **Framing** | Fixed orthographic board showing **entire settlement** — river, all pad sites, GH + Market + a few buildings, empty pads visible |
| **No zoom** | Wheel does not zoom; single fixed radius/ortho |
| **No orbit play** | Fixed alpha/beta (gentle optional pan max; prefer locked) |
| **Buildings** | Use best current glTF kits on **several** plots only (not empty world) — GH, Market, one field, one shop, harbor if easy |
| **Empty pads** | Visible, clear category markers, **no black ring stamps** under them if already fixable |
| **Workers** | **0–3** tiny people max for scale check — or **1** next to GH door. **Not** a crowd. Height ≈ door-relative (small). |
| **Fog** | Minimal so the board is readable for approval |
| **Label** | Optional on-screen “STANDARD VIEW — approve POV & scale” for capture only |

### Capture and present

1. Playwright or save: `tools/judge/evidence/standard-view/STANDARD-VIEW-DAY.png`  
2. Tell director:

   > “This is the **standard view** every player should get: full shore, fixed camera. Please confirm:  
   > (A) Perspective / angle OK?  
   > (B) Building size vs person size OK?  
   > (C) Can you see the whole play area without zooming?  
   > Reply Yes / No / notes.”

3. Write answers into **`STANDARD-VIEW-APPROVED.md`** (or Fail + fix framing and re-capture).

**Do not proceed to Step 3 until STANDARD-VIEW is Yes** (or director explicitly defers B/C with written notes you implement first).

---

## STEP 3 — Craft pass (only after Steps 1–2)

Follow director playtest issues (and keep approved boards + standard view as law):

### 3A — Presentation (from director play)

| Must fix | Detail |
|---|---|
| Fixed board camera | Same as approved standard view; no wheel zoom |
| Fog | Subtle heat only; not soup; not zoom-linked |
| Workers | Count from sim (assigned/total); sparse; small scale; **no** forced 14–26 crowd |
| No ghosting | Path on roads/pad edges only |
| **No black rings** | Remove mesh shadow discs/boxes under riverside kits |
| **No shadow-box stamps** | Remove kitLoader rake bars / hard `shadowBlob` / worker foot boxes; one soft real shadow system max |
| Focus | Buildings + pads + desert are heroes; people are accents |

### 3B — Structure honesty (if still boxes vs boards)

- Approved boards in `docs/visual-inspiration/` are silhouette targets.  
- Blender-reauthor glTF if standard view still shows cubes.  
- Structures ≤ 3 while reading as boxes.

### 3C — Deliverables

- `DIRECTOR-PLAY-PASS.md` checkboxes all green  
- `settlement-board-day.png`, `no-shadow-boxes.png`, workers count note  
- Server tests still green  

---

## Session script (say this as you go)

1. “Opening art storyboard for your Yes/No…” → URL  
2. Wait  
3. “Standard view capture ready…” → image + A/B/C questions  
4. Wait  
5. Implement Step 3  
6. “Play pass ready for re-check.”

---

## Forbidden

- Skipping to R18 atmosphere without storyboard + standard view approval  
- Inflating workers or zoom for “pretty stills”  
- Importing storyboard JPGs as final meshes  
- Claiming 8/10 while director issues remain  

---

## Skills / tools

- `fi-art-storyboard` / `fi-html-game` (FI pack)  
- Playwright for standard view  
- image_gen only if a board needs Revise  
- Blender only after Step 1–2 if structure rebuild needed  
