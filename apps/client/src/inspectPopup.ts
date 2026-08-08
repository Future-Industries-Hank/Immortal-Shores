/**
 * Full popup menu for any selected building (and later map sites).
 */
import {
  BUILDING_BLURB,
  BUILDING_TITLE,
  RESOURCE_LABELS,
  actionsForBuilding,
  buildingWorkerCap,
  canAssignWorkers,
  expectedOutputNow,
  formatHours,
  formatStacks,
  levelPreviews,
  nextUpgrade,
  type BuildingState,
  type PublicSnapshot,
  type ResourceId,
  type VaultBalances,
} from "@immortal/shared";
import { api } from "./api.js";
import { sfx } from "./audio.js";
import { GLYPHS, buildingIcon, levelPips, resourceIcon } from "./modern.js";

export type InspectHandlers = {
  onSnapshot: (s: PublicSnapshot) => void;
  onToast: (msg: string) => void;
  onClose: () => void;
  onOpenPanel?: (panel: string) => void;
};

function canAfford(vault: VaultBalances, seals: number, cost: { resource: string; amount: number }[], sealCost: number): boolean {
  if (seals < sealCost) return false;
  return cost.every((c) => (vault[c.resource] ?? 0) >= c.amount);
}

function costHtml(
  vault: VaultBalances,
  seals: number,
  cost: { resource: ResourceId; amount: number }[],
  sealCost: number
): string {
  const parts = cost.map((c) => {
    const have = vault[c.resource] ?? 0;
    const ok = have >= c.amount;
    return `<span class="${ok ? "cost-ok" : "cost-short"}">${resourceIcon(c.resource)}${c.amount} ${RESOURCE_LABELS[c.resource]} <small>(${Math.floor(have)})</small></span>`;
  });
  if (sealCost > 0) {
    const ok = seals >= sealCost;
    parts.push(
      `<span class="${ok ? "cost-ok" : "cost-short"}">${GLYPHS.seal}${sealCost} Sacred Seal <small>(${seals})</small></span>`
    );
  }
  return parts.join(" · ") || "—";
}


/** Remember whether the menu popup was open so hidePopup can restore it. */
let menuWasOpenForPopup = false;

function ensureScrim(root: HTMLElement) {
  let scrim = document.getElementById("popup-scrim");
  if (!scrim) {
    scrim = document.createElement("div");
    scrim.id = "popup-scrim";
    scrim.className = "popup-scrim";
    root.parentElement?.insertBefore(scrim, root);
  }
  (scrim as HTMLElement).hidden = false;
  // The modal owns the screen — hide the menu popup underneath, then restore
  // on close so drill-downs from Vault / Shore / Harbor don't strand the player.
  // Only latch "was open" when the menu is currently visible; re-renders while
  // the inspect popup is already up leave the latch alone.
  const menu = document.getElementById("menu-popup");
  if (menu) {
    if (!(menu as HTMLElement).hidden) menuWasOpenForPopup = true;
    (menu as HTMLElement).hidden = true;
  }
}

export function renderBuildingPopup(
  root: HTMLElement,
  state: PublicSnapshot,
  building: BuildingState,
  handlers: InspectHandlers
) {
  const st = state.settlements[0];
  if (!st) {
    root.hidden = true;
    return;
  }
  ensureScrim(root);
  root.hidden = false;
  root.classList.add("popup-open");

  const title = building.luxury
    ? `${BUILDING_TITLE[building.kind]} · ${RESOURCE_LABELS[building.luxury]}`
    : BUILDING_TITLE[building.kind];
  const blurb = BUILDING_BLURB[building.kind];
  const cap = buildingWorkerCap(building.kind, building.level);
  const free = st.workers - st.workersAssigned + building.workers;
  const assignable = canAssignWorkers(building.kind);
  const next = nextUpgrade(building.kind, building.level);
  const previews = levelPreviews(building.kind, building.level, building.luxury, 8);
  const expected = expectedOutputNow(
    building.kind,
    building.level,
    building.workers,
    building.luxury
  );
  const actions = actionsForBuilding(building.kind);
  const affordable =
    !next.maxed &&
    canAfford(state.player.vault, state.player.seals, next.cost, next.seals);

  const levelRows = previews
    .map((row) => {
      const cls = [
        "lvl-row",
        row.isCurrent ? "is-current" : "",
        row.isNext ? "is-next" : "",
        row.level < building.level ? "is-past" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const costLabel =
        row.level <= building.level
          ? row.isCurrent
            ? "Current"
            : "Owned"
          : formatStacks(row.upgradeCost) +
            (row.upgradeSeals ? ` + ${row.upgradeSeals} Seal` : "");
      const out = row.outputs
        .slice(0, 2)
        .map((o) => o.text)
        .join(" · ");
      return `<tr class="${cls}">
        <td><strong>L${row.level}</strong>${row.isCurrent ? " ●" : row.isNext ? " →" : ""}</td>
        <td>${row.workerCap || "—"}</td>
        <td>${row.level <= building.level ? "—" : formatHours(row.buildHours)}</td>
        <td class="cost-cell">${costLabel}</td>
        <td class="out-cell">${out}${row.special ? ` <em>${row.special}</em>` : ""}</td>
      </tr>`;
    })
    .join("");

  root.innerHTML = `
    <div class="popup-backdrop" id="popup-backdrop"></div>
    <div class="popup-card" role="dialog" aria-modal="true" aria-labelledby="popup-title">
      <button type="button" class="close-x" id="inspect-close" aria-label="Close">×</button>
      <header class="popup-head">
        <span class="popup-glyph">${buildingIcon(building.kind)}</span>
        <div class="popup-head-text">
          <h2 id="popup-title">${title}</h2>
          <p class="muted">Level ${building.level}${next.maxed ? " (max)" : ""} ${levelPips(building.level)}</p>
        </div>
      </header>

      <div class="popup-body">
        <section class="popup-section">
          <h3>What it is</h3>
          <p>${blurb}</p>
        </section>

        <section class="popup-section">
          <h3>Right now</h3>
          <p class="expected"><strong>${expected}</strong></p>
          ${
            assignable
              ? `<p class="muted">${building.workers} / ${cap} Workers · ${free} free in settlement · ${st.workers} total</p>
                 <div class="worker-ctrl">
                   <button type="button" id="w-minus" aria-label="Fewer workers">−</button>
                   <div class="count">${building.workers}</div>
                   <button type="button" id="w-plus" aria-label="More workers">+</button>
                 </div>
                 <div class="actions">
                   <button type="button" class="small secondary" id="w-zero">Clear</button>
                   <button type="button" class="small secondary" id="w-max">Fill cap</button>
                 </div>`
              : `<p class="muted">This structure does not take production Workers.</p>`
          }
        </section>

        <section class="popup-section">
          <h3>Next upgrade</h3>
          ${
            next.maxed
              ? `<p>Maximum level reached.</p>`
              : `<p>Upgrade to <strong>L${next.toLevel}</strong> · <strong>${formatHours(next.hours)}</strong> worker-hours</p>
                 <p class="cost-line">${costHtml(state.player.vault, state.player.seals, next.cost, next.seals)}</p>
                 ${
                   st.construction
                     ? `<p class="muted">Queue busy: ${BUILDING_TITLE[st.construction.kind] ?? st.construction.kind} → L${st.construction.targetLevel} (${st.construction.workerHoursDone.toFixed(1)}/${st.construction.workerHoursRequired.toFixed(1)} h)
                        <button type="button" class="small secondary" id="cancel-build">Cancel (~25% refund)</button></p>`
                     : ""
                 }`
          }
        </section>

        <section class="popup-section">
          <h3>Level path</h3>
          <p class="muted">Preview of levels, upgrade cost to reach each tier, build time, and outputs.</p>
          <div class="lvl-table-wrap">
            <table class="lvl-table">
              <thead>
                <tr>
                  <th>Lvl</th>
                  <th>Workers</th>
                  <th>Time</th>
                  <th>Cost to reach</th>
                  <th>Outputs / effects</th>
                </tr>
              </thead>
              <tbody>${levelRows}</tbody>
            </table>
          </div>
        </section>

        <section class="popup-section">
          <h3>What you can do</h3>
          <ul class="action-list">
            ${actions.map((a) => `<li>${a}</li>`).join("")}
          </ul>
          <div class="actions">
            ${
              building.kind === "market"
                ? `<button type="button" class="small secondary" id="go-wall">Open Tablet Wall</button>`
                : ""
            }
            ${
              building.kind === "harbor"
                ? `<button type="button" class="small secondary" id="go-harbor">Open Harbor</button>`
                : ""
            }
            ${
              building.kind === "training_grounds" || building.kind === "shrine"
                ? `<button type="button" class="small secondary" id="go-military">Open Military</button>`
                : ""
            }
          </div>
        </section>
      </div>

      ${
        next.maxed
          ? ""
          : `<footer class="popup-footer">
               <span class="muted">To L${next.toLevel} · ${formatHours(next.hours)}</span>
               <span class="spacer"></span>
               <button type="button" class="small ${affordable ? "primary" : "secondary"}" id="w-upgrade" ${affordable ? "" : 'title="Missing resources"'}>
                 ${building.kind === "great_house" ? "Upgrade Great House" : "Start upgrade"}
               </button>
             </footer>`
      }
    </div>
  `;

  const close = () => handlers.onClose();
  root.querySelector("#inspect-close")?.addEventListener("click", close);
  root.querySelector("#popup-backdrop")?.addEventListener("click", close);

  const setWorkers = async (n: number) => {
    try {
      const nextSnap = await api.workers(
        st.id,
        building.id,
        Math.max(0, Math.min(cap, n))
      );
      sfx.ok();
      handlers.onSnapshot(nextSnap);
    } catch (e) {
      sfx.warn();
      handlers.onToast((e as Error).message);
    }
  };

  root.querySelector("#w-minus")?.addEventListener("click", () => setWorkers(building.workers - 1));
  root.querySelector("#w-plus")?.addEventListener("click", () => setWorkers(building.workers + 1));
  root.querySelector("#w-zero")?.addEventListener("click", () => setWorkers(0));
  root.querySelector("#w-max")?.addEventListener("click", () => setWorkers(Math.min(cap, free)));

  root.querySelector("#w-upgrade")?.addEventListener("click", async () => {
    try {
      const kind = building.kind === "great_house" ? "great_house" : building.kind;
      const snap =
        building.kind === "great_house"
          ? await api.construct(st.id, "great_house")
          : await api.construct(st.id, kind, building.id);
      sfx.build();
      handlers.onSnapshot(snap);
    } catch (e) {
      sfx.warn();
      handlers.onToast((e as Error).message);
    }
  });

  root.querySelector("#cancel-build")?.addEventListener("click", async () => {
    try {
      handlers.onSnapshot(await api.cancelConstruct(st.id));
    } catch (e) {
      handlers.onToast((e as Error).message);
    }
  });

  root.querySelector("#go-wall")?.addEventListener("click", () => {
    handlers.onOpenPanel?.("wall");
    close();
  });
  root.querySelector("#go-harbor")?.addEventListener("click", () => {
    handlers.onOpenPanel?.("harbor");
    close();
  });
  root.querySelector("#go-military")?.addEventListener("click", () => {
    handlers.onOpenPanel?.("military");
    close();
  });
}

export function hidePopup(root: HTMLElement) {
  root.hidden = true;
  root.classList.remove("popup-open");
  root.innerHTML = "";
  const scrim = document.getElementById("popup-scrim");
  if (scrim) (scrim as HTMLElement).hidden = true;
  if (menuWasOpenForPopup) {
    const menu = document.getElementById("menu-popup");
    if (menu) (menu as HTMLElement).hidden = false;
    menuWasOpenForPopup = false;
  }
}

/** Generic info + actions popup (build catalog, map sites, barges, etc.). */
export function renderGenericPopup(
  root: HTMLElement,
  opts: {
    title: string;
    subtitle?: string;
    /** Building kind whose glyph decorates the header band. */
    glyphKind?: string;
    /** Direct GLYPHS key for the header band (wins over glyphKind). */
    glyphName?: string;
    what: string;
    details?: string[];
    levelTableHtml?: string;
    /** Heading above levelTableHtml (default "Levels & outputs"). */
    extraTitle?: string;
    primaryLabel?: string;
    primaryDisabled?: boolean;
    onPrimary?: () => void;
    secondaryLabel?: string;
    onSecondary?: () => void;
    onClose: () => void;
  }
) {
  ensureScrim(root);
  root.hidden = false;
  root.classList.add("popup-open");
  const glyph = opts.glyphName
    ? (GLYPHS[opts.glyphName] ?? GLYPHS.cartouche!)
    : opts.glyphKind
      ? buildingIcon(opts.glyphKind)
      : GLYPHS.cartouche!;
  const extraTitle = opts.extraTitle ?? "Levels & outputs";
  root.innerHTML = `
    <div class="popup-backdrop" id="popup-backdrop"></div>
    <div class="popup-card" role="dialog" aria-modal="true">
      <button type="button" class="close-x" id="inspect-close" aria-label="Close">×</button>
      <header class="popup-head">
        <span class="popup-glyph">${glyph}</span>
        <div class="popup-head-text">
          <h2>${opts.title}</h2>
          ${opts.subtitle ? `<p class="muted">${opts.subtitle}</p>` : ""}
        </div>
      </header>
      <div class="popup-body">
        <section class="popup-section">
          <h3>What it is</h3>
          <p>${opts.what}</p>
        </section>
        ${
          opts.details?.length
            ? `<section class="popup-section">
                <h3>Details</h3>
                <ul class="action-list">${opts.details.map((d) => `<li>${d}</li>`).join("")}</ul>
              </section>`
            : ""
        }
        ${
          opts.levelTableHtml
            ? `<section class="popup-section">
                <h3>${extraTitle}</h3>
                <div class="lvl-table-wrap">${opts.levelTableHtml}</div>
              </section>`
            : ""
        }
      </div>
      <footer class="popup-footer">
        <button type="button" class="small secondary" id="popup-dismiss">Close</button>
        ${
          opts.secondaryLabel
            ? `<button type="button" class="small secondary" id="popup-secondary">${opts.secondaryLabel}</button>`
            : ""
        }
        <span class="spacer"></span>
        ${
          opts.primaryLabel
            ? `<button type="button" class="small primary" id="popup-primary" ${opts.primaryDisabled ? "disabled" : ""}>${opts.primaryLabel}</button>`
            : ""
        }
      </footer>
    </div>
  `;
  const close = () => opts.onClose();
  root.querySelector("#inspect-close")?.addEventListener("click", close);
  root.querySelector("#popup-backdrop")?.addEventListener("click", close);
  root.querySelector("#popup-dismiss")?.addEventListener("click", close);
  root.querySelector("#popup-primary")?.addEventListener("click", () => {
    opts.onPrimary?.();
  });
  root.querySelector("#popup-secondary")?.addEventListener("click", () => {
    opts.onSecondary?.();
  });
}
