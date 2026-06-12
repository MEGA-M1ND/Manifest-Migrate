/**
 * Parsing logic preserved EXACTLY from the original chatgpt-to-claude-migrator.html
 * Do NOT rewrite or "improve" — this is tested against real ChatGPT exports including
 * split-shard formats.
 */
import JSZip from "jszip";

export const MAX_PART = 700 * 1024; // ~700 KB per merged part — sits comfortably in Claude knowledge

export const sanitize = (s) =>
  s.replace(/[\\/:*?"<>|#%&{}]/g, "").replace(/\s+/g, " ").trim().slice(0, 80) || "untitled";

// Walk the node graph from current_node back to root → ordered messages.
export function extractMessages(convo, customInstructionsRef) {
  const mapping = convo.mapping || {};
  let nodeId = convo.current_node;
  if (!nodeId || !mapping[nodeId]) {
    const ids = Object.keys(mapping);
    const hasChild = new Set();
    ids.forEach((id) => (mapping[id].children || []).forEach((c) => hasChild.add(c)));
    nodeId = ids.find((id) => (mapping[id].children || []).length === 0) || ids[ids.length - 1];
  }
  const chain = [];
  let guard = 0;
  while (nodeId && mapping[nodeId] && guard++ < 100000) {
    chain.push(mapping[nodeId]);
    nodeId = mapping[nodeId].parent;
  }
  chain.reverse();

  const out = [];
  for (const node of chain) {
    const m = node.message;
    if (!m || !m.author) continue;
    const role = m.author.role;
    const meta = m.metadata || {};
    const c = m.content || {};

    if (c.content_type === "user_editable_context") {
      if (customInstructionsRef) {
        customInstructionsRef.current = {
          profile: c.user_profile || "",
          instructions: c.user_instructions || "",
        };
      }
      continue;
    }
    if (role !== "user" && role !== "assistant") continue;
    if (meta.is_visually_hidden_from_conversation) continue;

    let text = "";
    if (c.content_type === "text" && Array.isArray(c.parts)) {
      text = c.parts.filter((p) => typeof p === "string").join("\n");
    } else if (c.content_type === "code") {
      text = "```" + (c.language && c.language !== "unknown" ? c.language : "") + "\n" + (c.text || "") + "\n```";
    } else if (c.content_type === "multimodal_text" && Array.isArray(c.parts)) {
      text = c.parts.map((p) => (typeof p === "string" ? p : "*[image]*")).join("\n");
    } else if (
      c.content_type === "thoughts" ||
      c.content_type === "reasoning_recap" ||
      c.content_type === "model_editable_context"
    ) {
      continue;
    } else if (typeof c.text === "string") {
      text = c.text;
    }
    text = (text || "").trim();
    if (!text) continue;
    out.push({ role, text });
  }
  return out;
}

export function convoToMarkdown(convo, includeDate, customInstructionsRef) {
  const msgs = extractMessages(convo, customInstructionsRef);
  if (!msgs.length) return null;
  const title = (convo.title || "Untitled conversation").trim();
  let md = "# " + title + "\n";
  if (includeDate && convo.create_time) {
    md += "*" + new Date(convo.create_time * 1000).toISOString().slice(0, 10) + "*\n";
  }
  md += "\n";
  for (const m of msgs) {
    md += "## " + (m.role === "user" ? "User" : "Assistant") + "\n\n" + m.text + "\n\n";
  }
  return md;
}

export function buildGroups(convos) {
  const map = new Map();
  let projN = 0,
    gptN = 0;
  for (const c of convos) {
    const gid = c.gizmo_id || c.conversation_template_id || null;
    let key, kind;
    if (gid && /^g-p-/.test(gid)) {
      key = gid;
      kind = "project";
    } else if (gid && /^g-/.test(gid)) {
      key = gid;
      kind = "gpt";
    } else {
      key = "__loose__";
      kind = "loose";
    }
    if (!map.has(key)) {
      let name;
      if (kind === "project") name = "Project " + ++projN;
      else if (kind === "gpt") name = "Custom GPT " + ++gptN;
      else name = "Ungrouped conversations";
      map.set(key, { id: key, name, kind, convos: [], checked: kind !== "loose" });
    }
    map.get(key).convos.push({
      title: (c.title || "Untitled").trim(),
      ts: c.create_time || 0,
      raw: c,
      checked: kind !== "loose",
    });
  }
  const groups = [...map.values()];
  const rank = { project: 0, gpt: 1, loose: 2 };
  groups.sort((a, b) => rank[a.kind] - rank[b.kind]);
  groups.forEach((g) => g.convos.sort((a, b) => b.ts - a.ts));
  return groups;
}

export async function loadFile(file) {
  let jsonText;
  if (/\.zip$/i.test(file.name) || (file.type || "").includes("zip")) {
    const zip = await JSZip.loadAsync(file);
    const entry = Object.values(zip.files).find(
      (f) => !f.dir && /(^|\/)conversations\.json$/i.test(f.name),
    );
    if (!entry) throw new Error("No conversations.json found inside this zip. Is it the ChatGPT data export?");
    jsonText = await entry.async("string");
  } else {
    jsonText = await file.text();
  }
  const data = JSON.parse(jsonText);
  const convos = Array.isArray(data)
    ? data
    : Array.isArray(data.conversations)
    ? data.conversations
    : null;
  if (!convos) throw new Error("Unrecognized JSON shape — expected an array of conversations.");
  return convos;
}

export function readme() {
  return [
    "# Importing this into Claude",
    "",
    "This archive was packed locally by Manifest — the ChatGPT → Claude Migration Kit. One folder = one Claude Project.",
    "",
    "## Steps",
    "",
    "1. In Claude (claude.ai), go to **Projects → Create project**. Name it after one of the folders here.",
    "2. Open that folder and drag its `.md` files into the project's **knowledge** panel.",
    "3. If `_custom-instructions.md` exists at the top level, paste the relevant parts into the project's **Set instructions** field.",
    "4. Repeat for each folder.",
    "5. In a new project chat, ask Claude: \"Summarize the context you have in this project's knowledge\" to verify the import.",
    "",
    "## Notes",
    "",
    "- Merged files are split into ~700 KB parts so they sit comfortably in project knowledge.",
    "- Conversations are formatted as `## User` / `## Assistant` turns under each conversation title.",
    "- Images and file attachments from ChatGPT are not included in its export's conversation data; re-upload any important files manually.",
    "",
  ].join("\n");
}

export async function packZip({
  groups,
  merged,
  withDates,
  withCI,
  customInstructions,
}) {
  const zip = new JSZip();
  const root = zip.folder("claude-migration");
  root.file("README-IMPORT-INSTRUCTIONS.md", readme());

  if (withCI && customInstructions && (customInstructions.profile || customInstructions.instructions)) {
    root.file(
      "_custom-instructions.md",
      "# Custom instructions carried over from ChatGPT\n\n" +
        "Paste the relevant parts into each Claude Project's **Set instructions** field, or into your Claude user preferences.\n\n" +
        (customInstructions.profile ? "## About the user\n\n" + customInstructions.profile + "\n\n" : "") +
        (customInstructions.instructions ? "## How the assistant should respond\n\n" + customInstructions.instructions + "\n" : ""),
    );
  }

  const used = new Set();
  const ciRef = { current: null };
  for (const g of groups) {
    const selected = g.convos.filter((c) => c.checked);
    if (!selected.length) continue;
    let fname = sanitize(g.name);
    while (used.has(fname)) fname += "_";
    used.add(fname);
    const folder = root.folder(fname);

    if (merged) {
      let part = 1,
        buf = "";
      const flush = () => {
        if (buf) {
          folder.file("conversations-part-" + part + ".md", buf);
          part++;
          buf = "";
        }
      };
      for (const c of selected) {
        const md = convoToMarkdown(c.raw, withDates, ciRef);
        if (!md) continue;
        if (buf && buf.length + md.length > MAX_PART) flush();
        buf += md + "\n---\n\n";
      }
      flush();
    } else {
      const seen = new Set();
      for (const c of selected) {
        const md = convoToMarkdown(c.raw, withDates, ciRef);
        if (!md) continue;
        let n = sanitize(c.title);
        while (seen.has(n)) n += "_";
        seen.add(n);
        folder.file(n + ".md", md);
      }
    }
  }
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  return blob;
}
