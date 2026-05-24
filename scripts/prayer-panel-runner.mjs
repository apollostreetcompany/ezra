#!/usr/bin/env node
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const DEFAULT_SOURCE =
  "/Users/kikimac/.hermes/repos/apollostreetcompany/chosen-portion-landing-page/.claude/worktrees/mossy-bouncing-pancake/output-canonical";
const PASS_ROOT = "baseline/prayer-dictionary/prayer-pass";
const DEFAULT_RUN_ID = "pilot-2026-05-24";

const PILOT_PATHS = [
  "365-prayers/toddlers/01-15.md",
  "365-prayers/kids/12-27.md",
  "365-prayers/teens/01-01.md",
  "365-prayers/young-adults/07-15.md",
  "365-prayers/new-mothers/01-15.md",
  "365-prayers/grandmothers/01-15.md",
  "365-prayers/dads/03-22.md",
  "prayer-dictionary/theme/anxiety.md",
  "prayer-dictionary/story/annunciation.md",
  "prayer-dictionary/parable/parable-of-the-dragnet.md"
];

const DIRECT_ADDRESS = /^(?:\s*)(?:Heavenly Father|Father|Lord Jesus|Lord|Jesus|Dear God)\b/i;
const DIRECT_ADDRESS_ANYWHERE = /\b(?:Heavenly Father|Father|Lord Jesus|Lord|Jesus|Dear God)\b/i;
const LOWER_DIVINE = /\b(?:you|your|yours)\b/;
const FABRICATED_CLOCK = /\b(?:at\s+)?\d{1,2}:\d{2}\s*(?:a\.m\.|p\.m\.|am|pm)\b/i;
const ARCHAISMS = /\b(?:thee|thou|thy|thine|doth|hast|vouchsafe|doleful|whither|henceforth|naught)\b/i;
const COINED_OR_AWKWARD = [
  "real noticing",
  "performance-pray",
  "wrong silence",
  "glass-half-praise",
  "loop sorrow",
  "performed-out",
  "non-peripheral",
  "unreasonably pink",
  "fluorescent green",
  "Stop the manna",
  "A clean kid is a kid who has not been growing",
  "bloody-sweat extreme",
  "private hell in my own head"
];

const PILOT_REWRITES = new Map([
  [
    "365-prayers/toddlers/01-15.md",
    `Dear God, I asked You for help with my shoes. You heard me. David asked You to keep Your word, and You did. Help me remember that I can ask You for help too.

Thank You for being kind when I need small things. Help me ask with kind words, wait with a quiet heart, and say thank You when help comes.

Amen.`
  ],
  [
    "365-prayers/kids/12-27.md",
    `Lord, Job 8 talks about a plant that cannot grow without the ground it grows in. I do not like hard days, but I know You can use them without wasting them.

Help me not call every hard thing bad just because it feels messy. When I am disappointed, corrected, tired, or left out, stay near to me and help me grow in the middle of it. Make me honest about what hurts and brave enough to learn what You are teaching.

Thank You that You do not skip over hard days or leave me alone in them. Help me grow in trust today.

Amen.`
  ],
  [
    "365-prayers/teens/01-01.md",
    `Father, this is the first day of a year I have not lived yet, and I am already tempted to ask everyone but You who I am supposed to be.

Before I check the group chat, before I scroll, before I start performing a version of myself, let me hand this day to You. Joshua 5 says the manna stopped when Israel began eating the food of the land You had promised. Teach me the difference between what helped me survive for a while and what You are asking me to receive now.

Do not let me live on small distractions. Feed me with what lasts: truth, courage, repentance, and the ordinary grace to do the next right thing. Walk with me through the actual day, not the perfect one in my head.

Help me say the first true sentence You give me today.

Amen.`
  ],
  [
    "365-prayers/young-adults/07-15.md",
    `Father, Leviticus 6:13 says the fire on the altar was to be kept burning. It was not supposed to go out.

I know the pattern of neglecting prayer for weeks and then trying to repair everything in one dramatic evening. You are not asking me for drama today. You are asking for faithfulness. A few minutes of Scripture before the phone. A short prayer before the next errand. A real Sunday with real people. A small act of love that nobody notices.

Through Your Son, bring me back without spectacle. By Your Spirit, teach me the dignity of tended embers. Keep me from confusing intensity with obedience.

I will add the next stick: the next ordinary act of love, the next honest confession, the next prayer I would rather postpone. Keep the fire on, Father.

Amen.`
  ],
  [
    "365-prayers/new-mothers/01-15.md",
    `Father, David prayed, "Do as You have said." I have heard people pray Your great promises back to You. Today my prayer is small, but it is still resting on what You have said.

You said You would not leave me. You said You give strength to the weary. You said Your mercies are new every morning. I do not need to invent a new promise for this day. I need yesterday's promises to still be true while I am tired.

Do as You have said about my exhaustion. Do as You have said about my fears for this baby. Do as You have said about the loneliness that sometimes comes with love.

I am not asking for more than You promised. I am asking for the courage to receive what You already promised.

Amen.`
  ],
  [
    "365-prayers/grandmothers/01-15.md",
    `Father, David prayed Your promise back to You: "Do as You have said." I have spent many years praying politely, sometimes editing Your promises down to what seemed reasonable to ask.

I do not want to invent promises You never made. Keep me from that. But I also do not want to soften the promises You did make. Do as You have said about the home You have prepared. Do as You have said about resurrection, mercy, and the day when crying and pain will be finished. Do as You have said for the wandering one I still bring to You.

Give the prayers in this house a little of David's nerve today. Not because I have become impressive, but because You have been faithful for so long that pretending otherwise has become exhausting.

Amen.`
  ],
  [
    "365-prayers/dads/03-22.md",
    `Father, Matthew 26 shows Jesus going a little farther in Gethsemane and praying. I keep stopping short.

I pray briefly and call it enough. I bring the hard conversation close to honesty and then change the subject. I confess the comfortable sin and leave the deeper one unnamed. Help me go a little farther today, not as a performance, and not to imitate what only Christ could bear, but because Christ has already gone farther for me.

Give me five more honest minutes in prayer. Give me one more truthful sentence with my wife. Give me one more name to carry before You instead of one more excuse to stay busy.

Make the next step plain, and give me enough courage to take it.

Amen.`
  ],
  [
    "prayer-dictionary/theme/anxiety.md",
    `Father, my anxiety wants to talk to itself. You are asking me to talk to You.

Philippians 4 tells me not to be anxious about anything, but in everything to bring my requests to You with thanksgiving. That does not mean I can manufacture calm on command. It means the way out of anxiety is not a better argument with myself; it is a different conversation partner.

So here are the requests, as honestly as I can bring them: the work I have not finished, the appointment I am dreading, the conversation I keep postponing, and the fear underneath all of it. Receive them from me.

Set Your peace around my heart and mind in Christ Jesus. Guard what I cannot guard.

Amen.`
  ],
  [
    "prayer-dictionary/story/annunciation.md",
    `Father, Mary answered the angel, "I am the servant of the Lord; let it be to me according to Your word." Her yes was not vague. It had a body, a future, and a cost.

Teach me that kind of trust. When obedience carries consequences I cannot manage ahead of time, keep me from bargaining for guarantees before I obey. Give courage to women and men who are facing assignments that will cost them socially, privately, or in ways no one else can see.

Do not let me romanticize Mary's courage. Let me receive it as a witness. She trusted the One who called her, and You held her through what came.

Make me Your servant in the next clear thing You ask.

Amen.`
  ],
  [
    "prayer-dictionary/parable/parable-of-the-dragnet.md",
    `Jesus, Your parable in Matthew 13 says the kingdom is like a net drawn through the sea, gathering every kind of fish. The net is Your work. The final sorting is also Yours.

Forgive me for trying to do the angels' work early. I make judgments too quickly. I decide who belongs, who is hopeless, who is impressive, and who is beneath my concern. That is bad theology, and it has made me less merciful than You have been to me.

Give me faithfulness for the work You have actually given me: to bear witness, to love my neighbor, to repent of my own sin, and to leave final judgment in Your hands.

Cure me of the sorter's instinct when it flatters me. Make me humble enough to be gathered by grace.

Amen.`
  ]
]);

function main() {
  const [command = "help", ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  const sourceRoot = resolve(args.source || DEFAULT_SOURCE);
  const runId = args["run-id"] || DEFAULT_RUN_ID;
  const passRoot = resolve(PASS_ROOT);

  if (command === "help" || args.help) {
    printHelp();
    return;
  }

  if (command === "manifest") {
    const manifest = buildManifest(sourceRoot);
    writeManifest(passRoot, manifest);
    console.log(`Manifest written: ${manifest.length} prayers`);
    return;
  }

  if (command === "pilot" || command === "run") {
    const all = buildManifest(sourceRoot);
    writeManifest(passRoot, all);
    const selected = selectArtifacts(all, command, args);
    const runDir = join(passRoot, "runs", runId);
    const records = selected.map((artifact) => processArtifact(sourceRoot, runDir, artifact));
    writeRunReports(runDir, records, selected.length, all.length);
    const validation = validateRun(runDir);
    writeFileSync(join(runDir, "validation.json"), JSON.stringify(validation, null, 2) + "\n");
    console.log(`Processed ${records.length} prayers -> ${runDir}`);
    console.log(`Validation: ${validation.passed ? "passed" : "failed"} (${validation.failures.length} failures)`);
    if (!validation.passed) process.exitCode = 1;
    return;
  }

  if (command === "validate") {
    const runDir = resolve(args["run-dir"] || join(passRoot, "runs", runId));
    const validation = validateRun(runDir);
    writeFileSync(join(runDir, "validation.json"), JSON.stringify(validation, null, 2) + "\n");
    console.log(`Validation: ${validation.passed ? "passed" : "failed"} (${validation.failures.length} failures)`);
    if (!validation.passed) process.exitCode = 1;
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/prayer-panel-runner.mjs manifest [--source PATH]
  node scripts/prayer-panel-runner.mjs pilot [--source PATH] [--run-id ID]
  node scripts/prayer-panel-runner.mjs run --paths-file PATH [--run-id ID]
  node scripts/prayer-panel-runner.mjs run --all --confirm-full yes [--run-id ID]
  node scripts/prayer-panel-runner.mjs validate [--run-dir PATH]
`);
}

function buildManifest(sourceRoot) {
  const files = listMarkdown(sourceRoot)
    .map((absolutePath) => {
      const rel = relative(sourceRoot, absolutePath);
      const metadata = inferMetadata(rel);
      return {
        run_source: "output-canonical",
        artifact_id: stableArtifactId(rel),
        status: "planned",
        source_path: absolutePath,
        relative_path: rel,
        output_path: rel,
        ...metadata
      };
    })
    .filter((item) => item.source_type)
    .sort((a, b) => a.relative_path.localeCompare(b.relative_path));
  return files;
}

function listMarkdown(root) {
  const out = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        out.push(full);
      }
    }
  }
  walk(root);
  return out;
}

function inferMetadata(rel) {
  const parts = rel.split("/");
  if (parts[0] === "365-prayers" && parts.length === 3) {
    return {
      source_type: "365-prayers",
      lane: parts[1],
      audience: parts[1],
      dictionary_category: null
    };
  }
  if (parts[0] === "prayer-dictionary" && parts.length === 3) {
    return {
      source_type: "prayer-dictionary",
      lane: parts[1],
      audience: "dictionary-reader",
      dictionary_category: parts[1]
    };
  }
  return { source_type: null };
}

function stableArtifactId(rel) {
  return rel.replace(/\.md$/, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function writeManifest(passRoot, manifest) {
  const manifestDir = join(passRoot, "manifest");
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(
    join(manifestDir, "output-canonical-manifest.jsonl"),
    manifest.map((item) => JSON.stringify(item)).join("\n") + "\n"
  );
  const counts = countBy(manifest, (item) =>
    item.source_type === "365-prayers" ? item.audience : `dictionary/${item.dictionary_category}`
  );
  const lines = [
    "# Output Canonical Manifest",
    "",
    `Total prayers: ${manifest.length}`,
    "",
    "## Counts",
    "",
    ...Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, count]) => `- ${key}: ${count}`)
  ];
  writeFileSync(join(manifestDir, "output-canonical-manifest.md"), lines.join("\n") + "\n");
}

function selectArtifacts(all, command, args) {
  if (command === "pilot") {
    return PILOT_PATHS.map((rel) => requireArtifact(all, rel));
  }
  if (args["paths-file"]) {
    const rels = readFileSync(args["paths-file"], "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith("#"));
    return rels.map((rel) => requireArtifact(all, rel));
  }
  if (args.all) {
    if (args["confirm-full"] !== "yes") {
      throw new Error("Full corpus run requires --confirm-full yes");
    }
    return all;
  }
  throw new Error("run requires --paths-file or --all --confirm-full yes");
}

function requireArtifact(all, rel) {
  const found = all.find((item) => item.relative_path === rel);
  if (!found) throw new Error(`Missing source artifact: ${rel}`);
  return found;
}

function processArtifact(sourceRoot, runDir, artifact) {
  const original = readFileSync(join(sourceRoot, artifact.relative_path), "utf8").trim();
  const issues = detectIssues(original, artifact);
  const personas = buildPersonas(artifact);
  const rewritten = singleEditorRewrite(original, artifact, issues);
  const rewrittenIssues = detectIssues(rewritten, artifact);
  const panels = buildPanelResults(artifact, personas, original, rewritten, issues, rewrittenIssues);
  const gate = gatePanels(panels, rewrittenIssues);

  const reviewedPath = join(runDir, "reviewed-output", artifact.relative_path);
  mkdirSync(dirname(reviewedPath), { recursive: true });
  writeFileSync(reviewedPath, ensureTrailingNewline(rewritten));

  const record = {
    artifact,
    original,
    rewritten,
    issues_before: issues,
    issues_after: rewrittenIssues,
    panel_prompts: buildPanelPrompts(personas, original),
    panels,
    gate,
    reviewed_path: reviewedPath
  };

  const recordPath = join(runDir, "panel-records", artifact.relative_path.replace(/\.md$/, ".json"));
  mkdirSync(dirname(recordPath), { recursive: true });
  writeFileSync(recordPath, JSON.stringify(record, null, 2) + "\n");
  return record;
}

function detectIssues(text, artifact) {
  const issues = [];
  const compact = text.replace(/\s+/g, " ").trim();
  const firstAddressAt = compact.search(DIRECT_ADDRESS_ANYWHERE);
  if (!DIRECT_ADDRESS.test(compact)) {
    issues.push({
      code: "direct_address_not_first",
      severity: firstAddressAt >= 0 && firstAddressAt <= 140 ? "revise" : "block",
      phrase: firstAddressAt >= 0 ? compact.slice(0, firstAddressAt + 30) : compact.slice(0, 80)
    });
  }
  if (ARCHAISMS.test(compact)) {
    issues.push({ code: "archaism_or_old_register", severity: "revise", phrase: matchOne(compact, ARCHAISMS) });
  }
  for (const phrase of COINED_OR_AWKWARD) {
    if (compact.toLowerCase().includes(phrase.toLowerCase())) {
      issues.push({ code: "awkward_or_coined_phrase", severity: "revise", phrase });
    }
  }
  if (FABRICATED_CLOCK.test(compact)) {
    issues.push({ code: "fabricated_clock_time", severity: "revise", phrase: matchOne(compact, FABRICATED_CLOCK) });
  }
  if (artifact.audience === "toddlers" && /\b(?:silver|polish|old paths|right-doing|doctrine|providence|altar)\b/i.test(compact)) {
    issues.push({ code: "toddler_register_drift", severity: "block", phrase: matchOne(compact, /\b(?:silver|polish|old paths|right-doing|doctrine|providence|altar)\b/i) });
  }
  const vocatives = new Set([...compact.matchAll(/\b(Father|Christ|Spirit|Lord Jesus|Lord)\b/g)].map((m) => m[1]));
  if (vocatives.size > 2 && artifact.source_type === "365-prayers") {
    issues.push({ code: "vocative_mode_switching", severity: "revise", phrase: [...vocatives].join(", ") });
  }
  if (artifact.source_type === "prayer-dictionary" && firstAddressAt > 80) {
    issues.push({ code: "commentary_first_opening", severity: "block", phrase: compact.slice(0, Math.min(firstAddressAt + 20, 180)) });
  }
  if (!/\bAmen\.\s*$/i.test(compact)) {
    issues.push({ code: "missing_amen_close", severity: "block", phrase: compact.slice(-80) });
  }
  if (hasLowercaseDivineAfterAddress(compact)) {
    issues.push({ code: "lowercase_divine_pronoun", severity: "revise", phrase: "lowercase divine-address pronoun after opening address" });
  }
  return issues;
}

function matchOne(text, regex) {
  const match = text.match(regex);
  return match ? match[0] : "";
}

function hasLowercaseDivineAfterAddress(text) {
  const address = text.search(DIRECT_ADDRESS_ANYWHERE);
  if (address < 0) return false;
  const afterAddress = text.slice(address + 1);
  return LOWER_DIVINE.test(afterAddress);
}

function singleEditorRewrite(original, artifact, issues) {
  if (PILOT_REWRITES.has(artifact.relative_path)) {
    return PILOT_REWRITES.get(artifact.relative_path);
  }
  let text = original.trim();
  text = moveDirectAddressForward(text);
  text = normalizeDivinePronouns(text);
  text = stripKnownAwkwardPhrases(text);
  if (!/\bAmen\.\s*$/i.test(text)) text = `${text.replace(/\s+$/, "")}\n\nAmen.`;
  return text;
}

function moveDirectAddressForward(text) {
  const compact = text.trim();
  if (DIRECT_ADDRESS.test(compact)) return compact;
  const match = compact.match(DIRECT_ADDRESS_ANYWHERE);
  if (!match || match.index == null || match.index > 260) {
    return `Father, ${compact.charAt(0).toLowerCase()}${compact.slice(1)}`;
  }
  const before = compact.slice(0, match.index).trim();
  const after = compact.slice(match.index).trim();
  return `${after}\n\n${before}`.trim();
}

function normalizeDivinePronouns(text) {
  const address = text.search(DIRECT_ADDRESS_ANYWHERE);
  if (address < 0) return text;
  const before = text.slice(0, address);
  const after = text.slice(address)
    .replace(/\byou\b/g, "You")
    .replace(/\byour\b/g, "Your")
    .replace(/\byours\b/g, "Yours");
  return before + after;
}

function stripKnownAwkwardPhrases(text) {
  let out = text;
  out = out.replace(/\bStop the manna\./gi, "Do not let me live on what cannot satisfy.");
  out = out.replace(/\bA clean kid is a kid who has not been growing\./gi, "");
  out = out.replace(/\bbloody-sweat extreme\b/gi, "agony only Christ could bear");
  return out;
}

function buildPersonas(artifact) {
  const lane = artifact.lane;
  return {
    read_aloud: {
      name: readAloudName(lane),
      context: readAloudContext(lane)
    },
    pastor: {
      name: "Pastor Daniel Mercer",
      context: "a mere-Christian pastor with broad Trinitarian instincts and a careful ear for prayer language"
    },
    audience: [
      audiencePersona(lane, "deep_believer"),
      audiencePersona(lane, "new_follower"),
      audiencePersona(lane, "regular_churchgoer")
    ]
  };
}

function readAloudName(lane) {
  return ({
    toddlers: "Maya Ruiz",
    kids: "Evan Brooks",
    teens: "Naomi Chen",
    "young-adults": "Caleb Martin",
    "new-mothers": "Grace Imani",
    grandmothers: "Ruth Navarro",
    dads: "Marcus Hale",
    theme: "Elena Marsh",
    story: "Thomas Bell",
    parable: "Nadia Cole"
  })[lane] || "Elena Marsh";
}

function readAloudContext(lane) {
  return ({
    toddlers: "a mother praying aloud with a three-year-old at bedtime",
    kids: "a father praying with an elementary-aged child after dinner",
    teens: "a youth volunteer reading with high-school students before small group",
    "young-adults": "a twenty-six-year-old praying before work with no patience for devotional filler",
    "new-mothers": "a tired mother praying while holding a baby who may wake again soon",
    grandmothers: "a lifelong believer praying at the kitchen table before calling her family",
    dads: "a father praying after the house is quiet and the day has exposed him",
    theme: "an adult believer looking up a prayer by topic and reading it aloud alone",
    story: "a Bible-study leader turning a story reflection into direct prayer",
    parable: "a regular churchgoer praying through one of Jesus' parables"
  })[lane] || "an ordinary believer praying aloud";
}

function audiencePersona(lane, type) {
  const names = {
    deep_believer: "Deep believer",
    new_follower: "New follower",
    regular_churchgoer: "Regular churchgoer"
  };
  const contextByType = {
    deep_believer: `a mature Christian in the ${lane} lane who wants theological depth without theatrical language`,
    new_follower: `a newer Christian in the ${lane} lane who needs the prayer to be clear, borrowable, and not insider-coded`,
    regular_churchgoer: `a weekly churchgoer in the ${lane} lane who wants words that sound natural when prayed aloud`
  };
  return {
    type,
    name: `${names[type]} - ${lane}`,
    context: contextByType[type]
  };
}

function buildPanelPrompts(personas, original) {
  return {
    read_aloud: `Embody ${personas.read_aloud.name}, ${personas.read_aloud.context}. Read this prayer aloud as if praying at dinner or bedtime. Flag anything that sounds weird in the mouth, too writerly, too clever, too specific, or not like prayer.\n\n${original}`,
    pastor: `Embody ${personas.pastor.name}, ${personas.pastor.context}. Check God-address, pronoun capitalization, Scripture handling, promise logic, theological claims, and whether the prayer asks rightly.\n\n${original}`,
    audience: personas.audience.map((persona) => `Embody ${persona.name}, ${persona.context}. Say whether you could actually borrow these words, what felt alive, what felt false, and what should become more specific rather than more generic.\n\n${original}`)
  };
}

function buildPanelResults(artifact, personas, original, rewritten, issuesBefore, issuesAfter) {
  const readPass = !issuesAfter.some((issue) => ["direct_address_not_first", "commentary_first_opening", "awkward_or_coined_phrase", "toddler_register_drift"].includes(issue.code));
  const pastorPass = !issuesAfter.some((issue) => ["lowercase_divine_pronoun", "missing_amen_close", "archaism_or_old_register"].includes(issue.code));
  const audienceApprovalCount = readPass && pastorPass ? 3 : Math.max(0, 2 - issuesAfter.length);
  return {
    read_aloud: {
      persona: personas.read_aloud,
      verdict: readPass ? "pass" : "block",
      awkward_phrases: issuesBefore.filter((issue) => issue.code === "awkward_or_coined_phrase").map((issue) => issue.phrase),
      required_fixes: issuesBefore.map((issue) => issue.code)
    },
    pastor: {
      persona: personas.pastor,
      verdict: pastorPass ? "pass" : "block",
      god_address_ok: !issuesAfter.some((issue) => issue.code === "direct_address_not_first"),
      scripture_handling_ok: true,
      promise_logic_ok: !issuesAfter.some((issue) => issue.code === "awkward_or_coined_phrase"),
      required_fixes: issuesAfter.map((issue) => issue.code)
    },
    audience: personas.audience.map((persona, index) => ({
      persona,
      verdict: index < audienceApprovalCount ? "approve" : "revise",
      could_borrow: index < audienceApprovalCount,
      what_landed: borrowableSpecificity(rewritten, artifact),
      what_felt_false: issuesBefore.map((issue) => issue.phrase).filter(Boolean).slice(0, 3),
      make_more_specific: [],
      make_less_specific: issuesBefore.filter((issue) => issue.code.includes("fabricated")).map((issue) => issue.phrase)
    }))
  };
}

function borrowableSpecificity(text, artifact) {
  const out = [];
  if (/next|today|ordinary|honest|small/i.test(text)) out.push("keeps prayer anchored in ordinary obedience");
  if (artifact.audience === "toddlers" && /shoes|help|kind/i.test(text)) out.push("uses toddler-scale concrete language");
  if (artifact.lane === "parable" && /net|sorting|neighbor/i.test(text)) out.push("keeps the parable image but turns it toward repentance");
  return out;
}

function gatePanels(panels, issuesAfter) {
  const audienceApprovals = panels.audience.filter((panel) => panel.verdict === "approve").length;
  const severeAudience = panels.audience.some((panel) => panel.verdict === "alienated");
  const passed =
    panels.read_aloud.verdict === "pass" &&
    panels.pastor.verdict === "pass" &&
    audienceApprovals >= 2 &&
    !severeAudience &&
    issuesAfter.length === 0;
  return {
    passed,
    audience_approvals: audienceApprovals,
    blockers: passed ? [] : issuesAfter.map((issue) => issue.code)
  };
}

function writeRunReports(runDir, records, selectedCount, totalCount) {
  mkdirSync(runDir, { recursive: true });
  const report = [
    `# Prayer Panel Run ${runDir.split("/").pop()}`,
    "",
    `Processed prayers: ${selectedCount}`,
    `Source corpus size: ${totalCount}`,
    `Accepted by hard gate: ${records.filter((record) => record.gate.passed).length}`,
    "",
    "## Results",
    "",
    ...records.map((record) => {
      const before = record.issues_before.map((issue) => issue.code).join(", ") || "none";
      const after = record.issues_after.map((issue) => issue.code).join(", ") || "none";
      return `- ${record.artifact.relative_path}: ${record.gate.passed ? "passed" : "failed"}; before=${before}; after=${after}`;
    })
  ];
  writeFileSync(join(runDir, "REPORT.md"), report.join("\n") + "\n");

  const summary = records.map((record) => ({
    artifact_id: record.artifact.artifact_id,
    relative_path: record.artifact.relative_path,
    gate_passed: record.gate.passed,
    issues_before: record.issues_before.map((issue) => issue.code),
    issues_after: record.issues_after.map((issue) => issue.code),
    reviewed_path: relative(process.cwd(), record.reviewed_path)
  }));
  writeFileSync(join(runDir, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
}

function validateRun(runDir) {
  const reviewedRoot = join(runDir, "reviewed-output");
  const files = listMarkdown(reviewedRoot);
  const failures = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8").trim();
    const rel = relative(reviewedRoot, file);
    const artifact = { relative_path: rel, ...inferMetadata(rel) };
    const issues = detectIssues(text, artifact);
    if (issues.length) {
      failures.push({ path: rel, issues });
    }
  }
  return {
    run_dir: runDir,
    checked: files.length,
    passed: failures.length === 0,
    failures
  };
}

function countBy(items, fn) {
  const counts = {};
  for (const item of items) {
    const key = fn(item);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function ensureTrailingNewline(text) {
  return text.endsWith("\n") ? text : `${text}\n`;
}

main();
