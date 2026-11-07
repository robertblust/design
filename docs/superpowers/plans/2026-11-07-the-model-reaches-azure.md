# The model reaches Azure — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three things that follow from `mcp.azure.companygraph.io` and `chat.azure.companygraph.io` going live on 2026-11-07: CompanyGraph's own model names the two Azure surfaces and what runs them; the organization's profile names the fourth deployment; and the chat on companygraph.io gains `/backend`, a command that lets a reader choose whether Google's or Azure's chat answers.

**Architecture:** Three repositories, three pull requests, in this order because nothing in one depends on another's merge. In `companygraph/mental-model`, two surface pages shaped like the Google ones, plus the pages the landscape needs to stay true: a `Microsoft Azure` processor, the two Azure platforms and the two Azure deployments as systems, the production environment's sentence and the two chat processing activities naming the new processor and surface. In `companygraph/.github`, a row, a node and a paragraph. In `robertblust/design`, `assets/chat.js` learns a tag attribute naming the backends, a `/backend` command with the same menu `/model` draws, a kept choice, and the policy that lets the page send to the chosen host; then `companygraph.github.io` names both backends on every page's chat tag and takes the release.

**Tech Stack:** Markdown held to core 0.71.0's schemas by `npx --yes github:companygraph/meta-model#v0.96.0 check`; the design package's `node --test` suite with Playwright; the site's `npm run design` sync.

**Spec:** none written; the owner skipped the questions on 2026-11-07 and the choices below are the executor's, named as such. The facts come from the deployment plans in `companygraph/mcp-azure-companygraph-io/docs/superpowers/plans/` and chat-server's two-clouds spec.

## Global Constraints

- The command is `/backend`, one word as `/model` and `/effort` are; the owner wrote `/chat-backend`, and the shorter name is the executor's call, to be renamed in one place if the owner wants the longer one.
- The tag attribute is `data-chat-backends`, space-separated `name=url` pairs, the first of which is `data-chat`'s own url; a tag naming none behaves exactly as today. The site names `google=https://chat.companygraph.io/chat azure=https://chat.azure.companygraph.io/chat`.
- The German strings follow the widget's existing voice in `chat.js`, which addresses the reader as du, even though `WRITING.md` says Sie; consistency within the file wins and the discrepancy is reported, not fixed here.
- The instance's pages follow `meta/core/CONVENTIONS.md` and each schema's writing rules; an id comes from `npx --yes github:companygraph/meta-model#v0.96.0 id`; `source: Local` throughout; no page states what a surface currently shows.
- Every claim in a page or the profile is one of today's facts: the Azure region is Switzerland North, the chat on Azure has no answer check and no sign-in, both services scale to zero, the model is the same commit as mcp.companygraph.io's until a re-pin moves one.
- Commits in the family's git register, authored by the Implementer at the repository's governing domain, trailers `Process: Delivery`, `Phase: Implement`, `Track: Code` (the instance's pages are prose, `Track: Prose`, authored by the Writer, `writer@companygraph.io`), `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`; pull request bodies end with the 🤖 line. Open each pull request and stop.
- A change to a synced file of the design package is a minor release; `package.json`'s `version` moves at tagging, not here.

## Review Focus

1. **A page with no `data-chat-backends`.** Every site but companygraph.io runs the widget without it; `/backend` must be no command there, sent as a question as `/login` is without an issuer, and `/help` must not list it. Pinned in Task 5's browser test.
2. **A kept choice the tag no longer names.** A reader who chose `azure` on a page whose tag later drops it must fall back to the tag's own endpoint silently. Pinned in Task 5.
3. **The policy.** A message to the chosen backend is refused by the page's `connect-src` unless `policyFor` adds every backend's origin; the site's pages carry the policy as a meta the sync writes. Pinned in Task 6's test.
4. **A signed-in reader on Azure.** The Azure chat has no sign-in and ignores `model`, `effort` and the bearer; the widget still sends them, and the answer's `done.by` names what answered. Nothing to change; Task 5 reads it as a known behavior.
5. **The surface claims.** `mcp.azure.companygraph.io`'s page carries structured data once the model names the surface, and the deployment's instance test asserts the opposite today; the re-pin that brings this commit to the Azure host flips that test. Pinned as Task 3's follow-on.

---

## Part A: companygraph/mental-model

Worktree `~/git/companygraph/mental-model-the-model-reaches-azure`, branch `the-model-reaches-azure`. A sweep of the whole model on 2026-11-07, for every page naming Google's cloud, the two hosts or the deployment repository, found what below is listed; pages that name only Google's sign-in, the registry entry or the answer check stay as they are, because the chat on Azure has none of the three. Every page is reviewed by the owner in the pull request, one at a time, as the instance's AGENTS.md asks. Ids come from `npx --yes github:companygraph/meta-model#v0.96.0 id`.

### Task 1: The processor, the platforms and the deployments

**Files:**

- Create: `model/data-processors/microsoft-azure.md`, `model/systems/azure-container-apps.md`, `model/systems/log-analytics.md`, `model/systems/mcp-server-on-azure.md`, `model/systems/chat-server-on-azure.md`.

- [ ] **Step 1: Microsoft Azure**

Frontmatter `legal-name: Microsoft Ireland Operations Limited`, `countries: [CH]`, `sub-processor-authorization: general`; H1 `Microsoft Azure`; tagline: runs the Azure copies of the MCP server and the chat server in its Switzerland North region and keeps there the chat's log of questions and its meter. `## References`: the Products and Services Data Protection Addendum, `https://www.microsoft.com/licensing/docs/view/Microsoft-Products-and-Services-Data-Protection-Addendum-DPA`; the subprocessor list, `https://aka.ms/subprocessor`; Microsoft's GDPR commitments, `https://learn.microsoft.com/legal/gdpr`. The Irish entity is the one Microsoft contracts with in Europe; no Swiss-specific entity was found, and the page says the Irish one.

- [ ] **Step 2: The two platforms**

Both `kind: Platform`, `owner: Owner`, `processor: Microsoft Azure`, `serves: [Answering]`, `environment: Production`. Azure Container Apps: runs the Azure copies of the two servers as containers in Switzerland North, deployed to on every merge to the repository that pins them, scaling to zero between requests; reference `https://learn.microsoft.com/azure/container-apps/`. Log Analytics: keeps the lines the chat server on Azure writes, the questions among them in a workspace of their own for ninety days, which the analyst identity and the owner read; `## Holds` Conversation, Question log, `writes`, since Cloud Logging holds the leading copy and the landscape marks one; reference `https://learn.microsoft.com/azure/azure-monitor/logs/`.

- [ ] **Step 3: The two deployments**

Both `kind: Deployment`, `owner: Owner`, `processor: Microsoft Azure`, `part-of: Azure Container Apps`, `environment: Production`. `MCP server on Azure`: answers questions about the same model at the same pinned commit as the MCP server, over the Model Context Protocol at mcp.azure.companygraph.io, the standing proof that the server runs on a second cloud; `## Connects to` GitHub as the MCP server's page has it; `## Holds` Instance, Snapshot, reads; references to mcp-server and `https://github.com/companygraph/mcp-azure-companygraph-io`. `Chat server on Azure`: answers the questions a visitor sends once the chat on companygraph.io is set to Azure, from what the MCP server on Azure returns, reaching the Claude API by federation and no key, with no answer check and no sign-in; `## Connects to` MCP server on Azure (Streamable HTTP, MCP endpoint, Entity, HTTPS) and Claude API (Messages API, HTTPS); `## Holds` Conversation, Question log, writes; references to chat-server, its interface and the Azure repository.

- [ ] **Step 4: Check and commit**

`npx --yes github:companygraph/meta-model#v0.96.0 check` passes; commit `The two servers run a second time, on Azure`, authored by the Writer, `Track: Prose`.

### Task 2: The two surfaces

**Files:**

- Create: `model/surfaces/mcp-azure-companygraph-io-mcp-server.md`, `model/surfaces/chat-azure-companygraph-io-chat.md`.

- [ ] **Step 1: The MCP surface**

H1 `mcp.azure.companygraph.io MCP server`, `production: built`, `built-by: https://github.com/companygraph/mcp-azure-companygraph-io`, `url: https://mcp.azure.companygraph.io`. Tagline: the mcp.companygraph.io MCP server a second time, on Azure, reading the same pinned commit of the model, for any agent that connects and as the standing proof that the server runs on a second cloud. `## What it shows`: the six units of the Google page, Endpoint, Title, Instructions, Tools, Page, Structured data, in that page's words, Endpoint saying no registry listing points at it.

- [ ] **Step 2: The chat surface**

H1 `chat.azure.companygraph.io chat`, same `built-by`, `url: https://chat.azure.companygraph.io`. Tagline: the chat a visitor reaches on companygraph.io once `/backend` chooses Azure, answered from what the mcp.azure.companygraph.io MCP server says at its pinned commit. `## What it shows`: Endpoint, Answer, From the model, Refusals, Page, in the Google page's words, and no Not fully backed, since this chat checks no answer.

- [ ] **Step 3: Check and commit**

`check` passes; commit `The model reaches Azure at two surfaces`.

### Task 3: The pages that were half true

**Files:**

- Modify: `model/environments/production.md`; `model/processing-activities/answering-in-the-chat.md`, `keeping-the-chat-s-questions.md`; `model/services/mcp-endpoint.md`, `chat-answer.md`; `model/questions/can-our-ai-agents-use-it.md`, `who-answers-this-chat.md`, `is-what-i-type-here-stored.md`; `model/requirements/nothing-a-company-writes-passes-through-us.md`, `the-question-is-kept-and-the-answer-is-not.md`; `model/controls/a-deployed-server-is-asked-which-commit-it-serves.md`; `model/kpis/deployment-frequency.md`, `change-fail-rate.md`, `change-lead-time.md`, `failed-deployment-recovery-time.md`, `deployment-rework-rate.md`; `model/surfaces/companygraph-io-website.md`; `model/use-cases/ask-the-company-a-question.md`, `publish-the-model-where-visitors-and-agents-reach-it.md`, `read-the-model-from-an-agent.md`.

- [ ] **Step 1: Where the servers run**

Production's `## What it means` gains, after the Cloud Run sentence: the same two servers run a second time as containers on Azure Container Apps in Switzerland North, reached at mcp.azure.companygraph.io and chat.azure.companygraph.io, deployed by a merge to mcp-azure-companygraph-io; `## References` gains that repository's deploy workflow and the Azure server's page. The two services gain `MCP server on Azure` and `Chat server on Azure` under `provided-by`, and their taglines name both addresses.

- [ ] **Step 2: What a visitor is told**

Both chat activities: `surfaces` gains `chat.azure.companygraph.io chat`, and `## Processors` gains a `Microsoft Azure` row, "The messages and the visitor's address, on the way to the answer, when the visitor chose the chat on Azure" and "The question and whether the model could answer it, kept in its Switzerland North region with the weekly report made from them, when the visitor chose the chat on Azure". The three questions gain a row each: `surface | mcp.azure.companygraph.io MCP server | | a second one, on Azure`, `surface | chat.azure.companygraph.io chat | | that a visitor may choose it with /backend`, `data-processor | Microsoft Azure | | who runs the chat and keeps the questions when Azure is chosen`. The website surface's Chat unit says the panel is answered by the chat.companygraph.io chat, or by the chat.azure.companygraph.io chat once `/backend` chose it.

- [ ] **Step 3: What is measured and held**

The five KPI pages: the deployment definition names mcp-azure-companygraph-io's deploy and chat workflows as publishing the two Azure surfaces, and the read-from list gains that repository. The control gains a sentence that mcp.azure.companygraph.io's deploy asks the same of its server, and a reference to that repository's deploy workflow. `nothing-a-company-writes-passes-through-us.md` gains, after the Google sentence, that on Azure `deployment.json` names the tenant, the subscription, the resource group and the location instead, and the realization table a row for the Azure repository's `deployment.json` at a pinned commit. `the-question-is-kept-and-the-answer-is-not.md` gains that on Azure the lines reach a Log Analytics workspace of the same ninety days, with a transformation keeping the question lines there and nowhere else. The three use cases gain a reference row each: the chat on Azure, the Azure deployment repository, the server on Azure.

- [ ] **Step 4: Check, commit, pull request**

`check` passes; commit `Every page that named one cloud names both`; push; pull request `The model reaches Azure`, body naming each page for the owner's one-at-a-time review and the executor's calls (the Log Analytics access, the Irish entity); stop. Two follow-ons: a stored item `chat-backend` for the key the widget keeps, added once the design release ships Part C; and the Azure deployment's instance test, README and AGENTS.md flip from "no structured data" to the sibling's shape in the re-pin that brings this commit to it.

## Part B: companygraph/.github

### Task 4: The profile names the fourth deployment

**Files:**

- Modify: `profile/README.md`.

- [ ] **Step 1: The table, the diagram and the list**

A row after `mcp-companygraph-io`'s: `[**mcp-azure-companygraph-io**](https://github.com/companygraph/mcp-azure-companygraph-io)`, "The same server and chat on CompanyGraph's own model a second time, on Azure, at [mcp.azure.companygraph.io](https://mcp.azure.companygraph.io/mcp) and [chat.azure.companygraph.io](https://chat.azure.companygraph.io): the proof that both run on a second cloud, and the one a reader of companygraph.io reaches with `/backend`". In the diagram, a node `MCPAZ` under `companygraph`, `<b>mcp.azure.companygraph.io</b><br/>and chat.azure.companygraph.io,<br/>on the second instance, on Azure`, with `MCP -- "pinned by tag" --> MCPAZ`, `CHAT -- "pinned by tag · deployed beside each server" --> MCPAZ`, `CGMM -- "pinned by commit · parsed into a snapshot" --> MCPAZ`, `DESIGN -- "pinned by tag" --> MCPAZ` folded into the existing lines, and `SITE -. "the chat button asks, when /backend says Azure" .-> MCPAZ`. In *Where we are*, item 7 names the Azure host beside the three, item 10 names chat.azure.companygraph.io, and a new item 12, ✅ **The second cloud**, says in one paragraph what the two-clouds design is and that the second instance runs on both since Nov 7, 2026, linking the spec in chat-server and the deployment repository.

- [ ] **Step 2: Check, commit, pull request**

`sh conventions/conventions-check && sh conventions/conventions-format` pass; commit `The profile names the deployment on Azure`; pull request; stop.

## Part C: robertblust/design, then companygraph.github.io

Worktree `~/git/robertblust/design-the-chat-chooses-its-backend`, branch `the-chat-chooses-its-backend`, which holds this plan.

### Task 5: `/backend` in the widget

**Files:**

- Modify: `assets/chat.js`, `test/chat.test.mjs`.
- Create: `test/chat-backend.test.mjs`.

**Interfaces:**

- Produces: `rbChat.backendsOf(attr, endpoint) → [{ name, url }]`, the tag's pairs with the first equal to `endpoint`, or `[]` where the attribute is absent, malformed or names no pair whose url is `endpoint`; `rbChat.command("/backend") → "backend"`; the attribute `data-chat-backends`; the `localStorage` key `chat-backend` holding a name.

- [ ] **Step 1: The pure tests, failing**

In `test/chat.test.mjs`, beside the command tests: `command("/backend")` is `"backend"` and `command("/backends")` is null; `backendsOf("google=https://a.test/chat azure=https://b.test/chat", "https://a.test/chat")` is the two pairs in order; the same with `"https://c.test/chat"` as the endpoint is `[]`; `backendsOf(null, "/chat")` is `[]`; a pair without `=` or with a url that is not absolute https or the page's own path is dropped. Run `node --test test/chat.test.mjs`: fails on `backendsOf` undefined.

- [ ] **Step 2: The pure parts**

`command()` adds `/backend`. `backendsOf(attr, endpoint)` as the Interfaces say, exported on `rbChat`. Run the file: passes.

- [ ] **Step 3: The browser test, failing**

`test/chat-backend.test.mjs`, in the shape of `test/chat-model.test.mjs` without the issuer: a page whose tag names `data-chat-backends="google=/chat azure=/chat-azure"` and `data-chat="/chat"`; the server answers both paths and records which was posted to. Tests: `/help` lists `/backend` on that page and not on a page without the attribute; `/backend` draws a menu headed by the strings' `menu.backend` with two rows and the first ticked; typing `2` picks azure, the keys line names `azure`, and the next message is posted to `/chat-azure`; a reload keeps the choice and the keys line; `/backend` then `1` sends to `/chat` again and the keys line drops the name; on the page without the attribute `/backend` is sent as a question. Run: fails.

- [ ] **Step 4: The widget**

`BACKENDS = backendsOf(tag.dataset.chatBackends, ENDPOINT)`, `BACKEND_KEY = "chat-backend"`; `backendNow()` returns the kept name's pair where `BACKENDS` still names it, else the first; `endpointNow()` its url. `send()` uses `to = high && DIRECT && backendNow() === BACKENDS[0] ? DIRECT : endpointNow()`, and `DIRECT` applies to the tag's own backend alone. `chooser("backend")` lists the names, the current ticked, and `choose("backend", name)` writes the key and redraws the keys line and the notice; `keysLine()` adds the name where it is not the first; `writeNotice()` and the panel's title read the host of `endpointNow()`. Strings: `menu.backend` "Choose a backend" / "Backend wählen"; help row `["/backend", "choose which cloud answers"]` / `["/backend", "wählen, welche Cloud antwortet"]`, listed only where `BACKENDS.length`; `/backend` on a tag without backends is a question, as `/login` is without an issuer. Run both test files: pass. Run the whole suite: green, `test/spelling.test.mjs` included.

- [ ] **Step 5: The map and the commit**

`docs/design-system/assets.md`'s chat paragraph gains one sentence: where the tag names more than one chat host, `/backend` lets the reader choose which answers, and the choice is kept in the browser. Commit `The chat's reader may choose which cloud answers`.

### Task 6: The policy follows the backends

**Files:**

- Modify: `lib/csp.mjs`, `test/csp.test.mjs`.

- [ ] **Step 1: The failing test**

In `test/csp.test.mjs`: a tag with `data-chat="https://chat.example.test/chat" data-chat-backends="google=https://chat.example.test/chat azure=https://chat.azure.example.test/chat"` yields `connect-src 'self' https://chat.example.test https://chat.azure.example.test`, and the Chromium test's sibling sends to the second origin. Run: fails.

- [ ] **Step 2: `policyFor`**

Reads `data-chat-backends`, splits on spaces, takes the part after the first `=`, adds each origin. Run: passes; whole suite green. Commit `The policy lets the page send to every backend the tag names`; push; pull request `The chat chooses its backend`, body saying what the site does to take it; stop. Release is the owner's: a minor, `version` moved at tagging.

### Task 7: companygraph.io names both backends

After the design release. Worktree of `companygraph.github.io`, branch `the-chat-has-two-backends`.

- [ ] **Step 1: The tags and the sync**

`package.json` re-pins `@robertblust/design` to the release; `npm install`; `npm run design` writes the new `chat.js` and, through the policy, every page's meta. Then `data-chat-backends="google=https://chat.companygraph.io/chat azure=https://chat.azure.companygraph.io/chat"` on every page's chat tag, found by `grep -rl 'data-chat="https://chat.companygraph.io/chat"' --include=index.html .`; `npm run design:check` and `npm run verify` pass, and `npm run og:check`, `pages:check`, `build:check` as the site's CI runs them.

- [ ] **Step 2: See it**

`npm run serve`, open `/`, type `/backend`, pick `2`, ask one question, and read the answer's commit line and the network request's host, `chat.azure.companygraph.io`. Commit `The chat offers Azure beside Google`; pull request; stop.
