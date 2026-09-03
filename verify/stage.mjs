// The stage's two checks, shared by every repository that draws one.
//
// They moved here from three separate copies of verify/check.mjs, where they had drifted:
// blust.ch's `graph` carried a 27-line assertion that no end of a spine may sit strictly
// within any node's rectangle, and companygraph.io's did not — while companygraph.io was the
// repository still rendering the bug it catches. Both halves of that fix, the repair in
// stage.js and the assertion here, now travel together or not at all.
//
// Neither check knows which site it is running against: `graph` takes the id of the page's
// data element from `spec.graph`, and `divider` needs nothing. That is why they could move
// unchanged.

export const STAGE_CHECKS = {
  async graph(page, spec) {
    const data = await page.evaluate((id) => JSON.parse(document.getElementById(id).textContent), spec.graph);
    if (!data.entities) return "the data block is empty — run: npm run example";
    // The source link and its short commit are rewritten by the script from the block's own
    // commit, so a stale generator that leaves the markup's placeholder in place would pass
    // every other check here while pointing at the wrong tree.
    // Which folder of the model repository the block came from is the page's to say, not
    // this check's: `stage.js` reads it off #srclink's data-src, so the assertion reads it
    // from the same place rather than carrying a second copy that could disagree.
    const srcSub = await page.evaluate(() => document.getElementById("srclink").getAttribute("data-src"));
    const srcHref = await page.evaluate(() => document.getElementById("srclink").getAttribute("href"));
    const wantHref = `/tree/${data.commit}/${srcSub}`;
    if (!srcHref.endsWith(wantHref)) return `source link is ${JSON.stringify(srcHref)}, expected it to end with ${JSON.stringify(wantHref)}`;
    const srcCommit = await page.evaluate(() => document.getElementById("srccommit").textContent);
    if (srcCommit !== data.commit.slice(0, 7)) return `source commit reads ${JSON.stringify(srcCommit)}, expected ${JSON.stringify(data.commit.slice(0, 7))}`;
    const nodes = () => page.evaluate(() => Array.from(document.querySelectorAll("#fig .n")).map(n => ({ id: n.dataset.id, focus: n.classList.contains("focus") })));
    const click = (id) => page.evaluate((id) => {
      const n = document.querySelector(`#fig .n[data-id="${id}"]`);
      if (n) n.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return !!n;
    }, id);
    // A singular type has no folder (core 0.4.0, R6/R13): its one entity hangs off the root
    // beside the folders, so it is counted here and never walked down to.
    const singular = new Set(data.types.filter(t => !t.owner && !t.folder).map(t => t.type));
    const roots = data.types.filter(t => !t.owner && t.folder).map(t => t.folder);
    // The root is the identity entity where an instance has one, drawn as one node rather
    // than two carrying the same name; the rest of the singular entities hang beside the
    // folders.
    const loose = data.entities.filter(e => singular.has(e.type) && e.id !== data.rootId);
    let ns = await nodes();
    if (!ns.find(n => n.id === "root" && n.focus)) return "initially the root is not the focus";
    if (ns.length !== roots.length + loose.length + 1)
      return `initially ${ns.length} nodes, expected root + ${roots.length} folders + ${loose.length} singular entities`;
    for (const e of loose)
      if (!ns.find(n => n.id === e.id)) return `${e.id} is a singular type's entity and is not drawn at the root`;
    if (data.rootId && ns.find(n => n.id === data.rootId))
      return `${data.rootId} is drawn beside the root it is`;
    // The walk below descends to a folder, so it needs an edge that starts inside one.
    const edge = data.edges.find(e => {
      const f = data.entities.find(x => x.id === e.from);
      return f && !singular.has(f.type);
    });
    if (!edge) return null;
    const from = data.entities.find(e => e.id === edge.from);
    const folder = from.id.slice(0, from.id.lastIndexOf("/"));
    // Walk down to that folder one click at a time. The canvas is a neighbourhood, not a
    // tree, so a folder four levels down is not on it until its parent is the focus — and
    // every prefix of an id IS a node here, because an id is the thing's path on disk.
    const parts = folder.split("/");
    for (let i = 1; i <= parts.length; i++) {
      const prefix = parts.slice(0, i).join("/");
      if (!(await click(prefix))) return `${prefix} is not on the canvas at this point in the walk`;
      await page.waitForTimeout(500);
    }
    ns = await nodes();
    if (!ns.find(n => n.id === folder && n.focus)) return `clicking ${folder} did not focus it`;
    if (!ns.find(n => n.id === "root")) return `focused ${folder}, but its ancestor root is gone`;
    if (!ns.find(n => n.id === from.id)) return `focused ${folder}, but its child ${from.id} is not drawn`;
    await click(from.id); await page.waitForTimeout(500);
    const name = await page.evaluate(() => (document.querySelector("#card h3") || {}).textContent);
    if (name !== from.name) return `card shows ${JSON.stringify(name)}, expected ${JSON.stringify(from.name)}`;
    // Where you are and how you got here, in the drawing rather than only in the breadcrumb.
    // `spine` was set on the ancestor chain and dropped before it reached the DOM, and the
    // focused node wore the same color as a hovered one, so the canvas said neither.
    const context = await page.evaluate(() => ({
      spines: document.querySelectorAll("#fig .own.spine").length,
      ancestors: document.querySelectorAll("#fig .n.ancestor").length,
      focusRing: (() => {
        const f = document.querySelector("#fig .n.focus .sq, #fig .n.focus .box");
        return f ? getComputedStyle(f).stroke : null;
      })(),
      hoverShares: (() => {
        // the focus must not simply be what a pointer already does
        const css = [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch (e) { return []; } });
        return css.some(r => r.selectorText && /\.n:hover .*\.n\.focus|\.n\.focus.*:hover/.test(r.selectorText));
      })(),
    }));
    if (!context.spines) return "the path from the root to the focus is not drawn — no .own.spine";
    if (!context.ancestors) return "no ancestor node is marked, so the path shows only as a line";
    if (!context.focusRing || context.focusRing === "none")
      return "the focused node carries no stroke of its own, so it reads as one more square";
    if (context.hoverShares) return "the focus is styled in the same rule as :hover, so it cannot be told from a pointer";
    // A line has to stop at the edge of the box it points at. The spine's ends were computed
    // from a flat half-width, and a folder's box is drawn taller than a page's square while
    // the focus is drawn larger than either — so a line into the focused folder ran six
    // pixels inside it. Geometry rather than appearance: no end of a spine may sit strictly
    // within any node's rectangle.
    const inside = await page.evaluate(() => {
      // Client coordinates on both sides, so nothing here parses a transform. Reading the
      // translate out of the attribute worked on a freshly loaded page and silently stopped
      // working after a click: d3 writes "translate(x y)" the first time and interpolates to
      // "translate(x, y)" through a transition, and a regex expecting the first form matched
      // nothing, put every node at the origin, and reported that all was well.
      const boxes = [...document.querySelectorAll("#fig .n")].map((n) => ({
        id: n.dataset.id, r: n.querySelector("rect").getBoundingClientRect(),
      }));
      const bad = [];
      for (const p of document.querySelectorAll("#fig .own.spine")) {
        const m = p.getScreenCTM();
        const ends = [p.getPointAtLength(0), p.getPointAtLength(p.getTotalLength())]
          .map((pt) => new DOMPoint(pt.x, pt.y).matrixTransform(m));
        for (const pt of ends)
          for (const b of boxes)
            if (pt.x > b.r.left + 1 && pt.x < b.r.right - 1 && pt.y > b.r.top + 1 && pt.y < b.r.bottom - 1)
              bad.push(`${b.id} (${pt.x.toFixed(0)},${pt.y.toFixed(0)})`);
      }
      return [...new Set(bad)];
    });
    if (inside.length) return `a spine ends inside a node instead of at its edge: ${inside.join(", ")}`;
    // The stage, expanded: Expand moves the whole stage — path, canvas and card — into
    // dialog#stagemodal, closed by its ×, Escape or a backdrop click. It is the same stage
    // moved, not a copy, so this checks the dialog actually contains #fig and #card (rather
    // than a second rendering of them) and that the canvas really grew, then that the move
    // back on close lands #fig inside .figure-section again — nothing here is a literal from
    // the example, every name comes from the block or from the DOM itself.
    if (!(await page.evaluate(() => !!document.getElementById("expand")))) return "#expand is missing";
    const orderBefore = await page.evaluate(() =>
      [...document.querySelector(".figure-section").children].map(e => e.id || e.className));
    const widthBefore = await page.evaluate(() => document.getElementById("fig").getBoundingClientRect().width);
    await page.click("#expand");
    await page.waitForTimeout(300);
    const modalOpen = await page.evaluate(() => !!document.querySelector("dialog#stagemodal[open]"));
    if (!modalOpen) return "clicking #expand did not open dialog#stagemodal";
    const holds = await page.evaluate(() => {
      const dialog = document.getElementById("stagemodal");
      return dialog.contains(document.getElementById("fig")) && dialog.contains(document.getElementById("card"));
    });
    if (!holds) return "dialog#stagemodal does not contain #fig and #card — Expand should move the stage, not copy it";
    const widthAfter = await page.evaluate(() => document.getElementById("fig").getBoundingClientRect().width);
    if (!(widthAfter > widthBefore)) return `#fig width in the dialog is ${widthAfter}, expected more than ${widthBefore} before Expand`;
    const stillFocused = await page.evaluate((id) => {
      const n = document.querySelector(`#fig .n[data-id="${id}"]`);
      return !!n && n.classList.contains("focus");
    }, from.id);
    if (!stillFocused) return `${from.id} is no longer the focus after Expand`;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    if (await page.evaluate(() => !!document.querySelector("dialog[open]"))) return "Escape did not close dialog#stagemodal";
    const backInPlace = await page.evaluate(() => document.querySelector(".figure-section").contains(document.getElementById("fig")));
    if (!backInPlace) return "closing the dialog did not move #fig back inside .figure-section";
    // Back inside is not back in place. The restore used to insert the stage before the
    // caption, which was right only while nothing sat between them; the moment a page put a
    // line there, closing the dialog left it above the drawing instead of below it. Compare
    // the whole running order, not just containment.
    const orderAfter = await page.evaluate(() =>
      [...document.querySelector(".figure-section").children].map(e => e.id || e.className));
    if (orderAfter.join(" ") !== orderBefore.join(" "))
      return `closing the dialog left the figure section as ${orderAfter.join(" ")}, was ${orderBefore.join(" ")}`;
    const drawn = await page.evaluate((id) => Array.from(document.querySelectorAll(`#fig .ref[data-from="${id}"]`)).map(p => p.dataset.to), from.id);
    for (const x of data.edges.filter(x => x.from === from.id)) if (!drawn.includes(x.to)) return `reference ${from.id} → ${x.to} is in the block but not drawn`;
    ns = await nodes();
    for (const x of data.edges.filter(x => x.from === from.id)) if (!ns.find(n => n.id === x.to)) return `reference target ${x.to} is not on the canvas`;
    const hash = await page.evaluate(() => decodeURIComponent(location.hash.slice(1)));
    if (hash !== from.id) return `hash is ${JSON.stringify(hash)}, expected ${from.id}`;
    return null;
  },

  async divider(page, spec) {
    const CANVAS_MIN = 320;
    await page.goto(spec.absolute, { waitUntil: "networkidle" });
    await page.evaluate(() => { try { localStorage.removeItem("stage-card"); localStorage.removeItem("stage-card-modal"); } catch (e) {} });
    await page.reload({ waitUntil: "networkidle" });
    const width = () => page.evaluate(() => Math.round(document.querySelector(".card").getBoundingClientRect().width));
    const canvas = () => page.evaluate(() => Math.round(document.querySelector(".canvas").getBoundingClientRect().width));
    const g = await page.$("#gutter");
    if (!g) return "there is no divider between the canvas and the card";
    const before = await width();
    // With nothing stored the two panes start equal — the reader is shown both halves of the
    // stage and decides from there, rather than being given a details column sized for the
    // narrowest thing it ever has to hold.
    if (Math.abs((await canvas()) - before) > 2)
      return `the stage does not open even: canvas ${await canvas()}, card ${before}`;

    // The stage is taller than the window the suite runs at, so the handle's midpoint can sit
    // below the fold — a press aimed there lands on nothing and the drag silently does not
    // happen. Bring it into view and aim at a point that is certainly on screen.
    await page.$eval(".stage", (el) => el.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(150);
    const box = await g.boundingBox();
    const y = Math.min(box.y + box.height / 2, box.y + 60);
    await page.mouse.move(box.x + box.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(box.x - 160, y, { steps: 8 });
    await page.mouse.up();
    const dragged = await width();
    if (!(dragged > before)) return `dragging the divider left did not widen the card: ${before} → ${dragged}`;
    const stored = await page.evaluate(() => localStorage.getItem("stage-card"));
    if (!stored) return "the width was not remembered after a drag";

    await page.reload({ waitUntil: "networkidle" });
    if (Math.abs((await width()) - dragged) > 2) return `the remembered width did not survive a reload: ${await width()} vs ${dragged}`;

    // A stored width wider than the box must clamp, and the canvas keeps its floor.
    await page.evaluate(() => localStorage.setItem("stage-card", "9000"));
    await page.reload({ waitUntil: "networkidle" });
    if ((await canvas()) < CANVAS_MIN)
      return `a stored width of 9000 left the canvas at ${await canvas()}px, under its ${CANVAS_MIN}px floor`;

    await page.dblclick("#gutter");
    if (Math.abs((await width()) - before) > 2) return `double-click did not restore the even split: ${await width()} vs ${before}`;
    if (Math.abs((await canvas()) - (await width())) > 2)
      return `double-click left the panes uneven: canvas ${await canvas()}, card ${await width()}`;
    if (await page.evaluate(() => localStorage.getItem("stage-card")))
      return "double-click restored the default but left the old width stored";

    // Drag is not the only way in: a control that needs a pointer is unreachable without one.
    await page.focus("#gutter");
    await page.keyboard.press("ArrowLeft");
    if (!((await width()) > before)) return "the divider does not respond to the keyboard";
    const onPage = await width();

    // Two boxes, two memories. The page gives the stage a column and the dialog gives it most
    // of the window, so one number would be clamped to the page's maximum every time the
    // dialog closed and the reader's choice in the wider box would be lost coming back.
    await page.click("#expand");
    await page.waitForTimeout(300);
    const dialogDefault = await width();
    if (dialogDefault === onPage)
      return "the dialog opened at the page's width, so the two boxes share one memory";
    await page.focus("#gutter");
    await page.keyboard.press("ArrowLeft");
    const inDialog = await width();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    if (Math.abs((await width()) - onPage) > 2)
      return `closing the dialog left the page at ${await width()}, expected its own ${onPage}`;
    await page.click("#expand");
    await page.waitForTimeout(300);
    if (Math.abs((await width()) - inDialog) > 2)
      return `the dialog forgot its own width: ${await width()}, expected ${inDialog}`;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    await page.evaluate(() => { try { localStorage.removeItem("stage-card"); localStorage.removeItem("stage-card-modal"); } catch (e) {} });
    await page.goto(spec.absolute, { waitUntil: "networkidle" });
    return null;
  },
};
