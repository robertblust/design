// The checks that hold a page generated from a model to the model it was generated from: the
// team board and the surfaces lineage. They were a site's own until a second site drew them, and
// each hard-coded that site's model — its row count, its phase names, its gate count — so they
// read everything they expect from the artifact the page names instead, through the same helpers
// the renderers use. Only reading the page happens in the browser.
//
// Both also check where a card sends a reader. The page declares STAGE_PAGE, and the page it
// names must draw the same artifact, or a seat or a surface opens onto a stage that does not
// hold it. Nothing else could see that: the link is written by a script when a card opens, and
// every other check passed with it pointing anywhere.
import { processesOf, phasesOf, seatsOf, marksOf, procSlug } from "../lib/render/team.mjs";

// Each board the page must carry: its id prefix, its process's name, its phase headings, and each
// row's name and gate count, in the order the renderer draws them. One process draws unprefixed
// ids; several draw each under its process's slug.
export function boardsOf(data) {
  const procs = processesOf(data);
  return procs.map((proc) => {
    const marks = marksOf(data, proc);
    return {
      prefix: procs.length > 1 ? `${procSlug(proc.name)}-` : "",
      name: proc.name,
      phases: phasesOf(data, proc).map((p) => p.name),
      rows: seatsOf(data, proc).map(({ role }) => ({
        name: role.name,
        gates: marks[role.name].filter((m) => m.includes("ga")).length,
      })),
    };
  });
}

// The artifact the page names, found the way the stage finds it.
async function artifact(page) {
  return page.evaluate(async () => {
    const link = document.querySelector("link[data-stage]");
    if (!link) return null;
    return { href: link.href, data: await (await fetch(link.href)).json() };
  });
}

// STAGE_PAGE is a top-level `var` in the page's own script, so it is a property of window. The
// page it names is fetched, and the file its data-stage link names is resolved against it.
async function stageTarget(page) {
  return page.evaluate(async () => {
    if (typeof window.STAGE_PAGE !== "string") return { error: "the page declares no STAGE_PAGE" };
    const url = new URL(window.STAGE_PAGE, location.href);
    const res = await fetch(url);
    if (!res.ok) return { error: `STAGE_PAGE ${window.STAGE_PAGE} answers HTTP ${res.status}` };
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    const link = doc.querySelector("link[data-stage]");
    const href = link && link.getAttribute("href");
    if (!href) return { error: `STAGE_PAGE ${window.STAGE_PAGE} draws no stage` };
    return { stage: window.STAGE_PAGE, draws: new URL(href, url).href };
  });
}

function sameArtifact(target, art) {
  if (target.error) return [target.error];
  if (target.draws !== art.href) return [`STAGE_PAGE ${target.stage} draws ${target.draws}, this page ${art.href}`];
  return [];
}

// The provenance line names the commit the page was read from, not the markup's placeholder.
async function provenance(page, data) {
  const said = await page.evaluate(() => document.getElementById("srccommit").textContent.trim());
  const href = await page.evaluate(() => document.getElementById("srclink").href);
  const bad = [];
  if (said !== data.commit.slice(0, 7)) bad.push(`the provenance line reads @${said}, the artifact is at ${data.commit.slice(0, 7)}`);
  if (!href.includes("/tree/" + data.commit + "/")) bad.push("the provenance link is not pinned to the artifact's commit");
  return bad;
}

export const MODEL_PAGE_CHECKS = {
  async board(page, spec) {
    await page.goto(spec.absolute, { waitUntil: "networkidle" });
    const art = await artifact(page);
    if (!art) return "the page names no data";
    await page.waitForTimeout(300);
    const bad = await provenance(page, art.data);
    const target = await stageTarget(page);
    bad.push(...sameArtifact(target, art));

    const boards = boardsOf(art.data);
    for (const want of boards) {
      const got = await page.evaluate((prefix) => {
        const grid = document.getElementById(prefix + "board");
        if (!grid) return null;
        return {
          heads: [...grid.querySelectorAll(".ghead .phname")].map((e) => e.textContent.trim()),
          rows: [...grid.querySelectorAll("details")].map((d) => ({
            name: d.querySelector(".tw").textContent.trim(),
            gates: d.querySelectorAll("summary > span:not(.sname) .g.ga").length,
            label: d.querySelector("summary").getAttribute("aria-label") || "",
          })),
        };
      }, want.prefix);
      const where = want.prefix ? `${want.name}: ` : "";
      if (!got) { bad.push(`${where}there is no #${want.prefix}board`); continue; }
      if (got.heads.join("|") !== want.phases.join("|"))
        bad.push(`${where}the phase headings are ${got.heads.join(" · ")}, the model's ${want.phases.join(" · ")}`);
      if (got.rows.map((r) => r.name).join("|") !== want.rows.map((r) => r.name).join("|"))
        bad.push(`${where}the rows are ${got.rows.map((r) => r.name).join(", ")}, the model's ${want.rows.map((r) => r.name).join(", ")}`);
      for (const r of want.rows) {
        const g = got.rows.find((x) => x.name === r.name);
        if (!g) continue;
        if (g.gates !== r.gates) bad.push(`${where}${r.name} carries ${g.gates} gate marks, the model ${r.gates}`);
        // Every row says itself in words, because the grid is not a table: a tr cannot be
        // wrapped in details, and a summary given role="row" would stop announcing that it opens.
        if (!g.label.startsWith(r.name + ",")) bad.push(`${where}${r.name}'s summary has no aria-label naming it`);
        if (!/approves (the gate of|no gate)/.test(g.label)) bad.push(`${where}${r.name}'s aria-label says nothing about gates`);
      }
    }

    // A seat opens onto its card, rendered on demand and not before, and a reference in it leaves
    // for STAGE_PAGE. The rows of the first board the page draws are opened until one card
    // carries a reference, so the link is checked wherever the model gives a seat one. A model
    // whose seats reference nothing on the stage leaves nothing to follow, and that is not the
    // page's fault; STAGE_PAGE is held above either way.
    const firstId = await page.evaluate(() => (document.querySelector('.grid[id$="board"]') || {}).id);
    const first = boards.find((b) => b.prefix + "board" === firstId) || boards[0];
    const opened = await page.evaluate(async ({ prefix, names }) => {
      const rows = [...document.getElementById(prefix + "board").querySelectorAll("details")];
      const out = { rendered: [], early: false, go: null };
      for (const name of names) {
        const d = rows.find((x) => x.querySelector(".tw").textContent.trim() === name);
        if (!d) continue;
        if (d.querySelector(".cbody").textContent.trim()) out.early = true;
        d.open = true;
        await new Promise((r) => setTimeout(r, 300));
        const h3 = d.querySelector(".cbody h3");
        out.rendered.push([name, h3 ? h3.textContent.trim() : null]);
        const go = d.querySelector(".cbody a.go");
        if (go) { out.go = go.getAttribute("href"); break; }
      }
      return out;
    }, { prefix: first.prefix, names: first.rows.map((r) => r.name) });
    if (opened.early) bad.push("a card is rendered before its row was opened");
    for (const [name, h3] of opened.rendered) if (h3 !== name) bad.push(`opening the ${name} row did not render its card`);
    if (opened.go && !target.error && !opened.go.startsWith(target.stage + "?stage=expanded#"))
      bad.push(`a card link points at ${opened.go}, not at ${target.stage}`);
    // A seat on two boards is two rows, and each row's card is its own. So the first row of every
    // other board is opened too, after the first board's rows: a card remembered by seat rather
    // than by row stays empty there, and did.
    for (const b of boards.filter((x) => x !== first)) {
      const got = await page.evaluate(async (prefix) => {
        const d = document.getElementById(prefix + "board").querySelector("details");
        d.open = true;
        await new Promise((r) => setTimeout(r, 300));
        const h3 = d.querySelector(".cbody h3");
        return { name: d.querySelector(".tw").textContent.trim(), h3: h3 && h3.textContent.trim() };
      }, b.prefix);
      if (got.h3 !== got.name) bad.push(`${b.name}: opening the ${got.name} row did not render its card`);
    }
    return bad.length ? bad.join("; ") : null;
  },

  // Every surface in the artifact is a node, under the maker its own production and built-by
  // name; choosing one draws its card and lights its two wires, and nothing is rendered before a
  // choice.
  async lineage(page, spec) {
    await page.goto(spec.absolute, { waitUntil: "networkidle" });
    const art = await artifact(page);
    if (!art) return "the page names no data";
    const bad = await provenance(page, art.data);
    bad.push(...sameArtifact(await stageTarget(page), art));
    const want = art.data.entities.filter((e) => e.type === "surface").map((s) => ({
      id: s.id, name: s.name, maker: s.fields.production === "written" ? "hand" : s.fields["built-by"] }));
    const inPage = await page.evaluate(async (want) => {
      const bad = [];
      const btns = [...document.querySelectorAll("#lineage .ln-s")];
      if (btns.length !== want.length) bad.push(`the drawing has ${btns.length} surfaces, the model ${want.length}`);
      for (const s of want) {
        const b = btns.find((x) => x.getAttribute("data-id") === s.id);
        if (!b) { bad.push(`${s.name} is not drawn`); continue; }
        if (b.getAttribute("data-maker") !== s.maker) bad.push(`${s.name} sits under ${b.getAttribute("data-maker")}, not ${s.maker}`);
        const group = b.closest(".ln-group").querySelector(".ln-maker").getAttribute("data-maker");
        if (group !== s.maker) bad.push(`${s.name} is nested under ${group}, not ${s.maker}`);
        if (b.querySelector(".nm").textContent.trim() !== s.name) bad.push(`${s.id} is labeled ${b.querySelector(".nm").textContent}`);
      }
      const panel = document.getElementById("lnpanel");
      if (!panel.hidden || panel.querySelector(".cbody").textContent.trim()) bad.push("a card is shown before a surface was chosen");
      const wires = document.querySelectorAll("#wires path").length;
      const makers = document.querySelectorAll(".ln-maker").length;
      if (wires !== makers + btns.length) bad.push(`${wires} wires for ${makers} makers and ${btns.length} surfaces`);
      const pick = btns.find((b) => b.getAttribute("data-maker") === "hand") || btns[0];
      if (!pick) return { bad, id: null };
      pick.click();
      await new Promise((r) => setTimeout(r, 300));
      const h3 = panel.querySelector(".cbody h3");
      const name = pick.querySelector(".nm").textContent.trim();
      if (panel.hidden || !h3 || h3.textContent.trim() !== name) bad.push(`choosing ${name} did not draw its card`);
      if (/\*\*/.test(panel.querySelector(".cbody").textContent)) bad.push(`${name}'s card prints markdown asterisks`);
      if (pick.getAttribute("aria-pressed") !== "true") bad.push(`${name} is not pressed once chosen`);
      if (location.hash !== "#" + pick.id) bad.push(`choosing ${name} left the address at ${location.hash || "no hash"}`);
      const lit = document.querySelectorAll("#wires path.on").length;
      if (lit !== 2) bad.push(`choosing ${name} lit ${lit} wires, not 2`);
      return { bad, id: pick.id };
    }, want);
    bad.push(...inPage.bad);
    // A link must land: arriving with a hash chooses that surface.
    if (inPage.id) {
      await page.goto(spec.absolute + "#" + inPage.id, { waitUntil: "networkidle" });
      await page.waitForTimeout(300);
      const landed = await page.evaluate((id) => document.getElementById(id).getAttribute("aria-pressed") === "true"
        && !!document.querySelector("#lnpanel .cbody h3"), inPage.id);
      if (!landed) bad.push(`arriving on #${inPage.id} did not choose it`);
    }
    return bad.length ? bad.join("; ") : null;
  },
};
