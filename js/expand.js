/* Idea Forge — expansion engine.
   Source data is authored as compact pipe-delimited cores (one line per idea) to keep
   authoring fast and consistent. This module turns each core into a full, richly
   described record: every entry gets its own loop, twist, level design, first minute,
   difficulty curve, depth, art direction, prototype plan, retention, monetisation,
   pitfalls and a prior-art note.

   Deterministic: the same core always expands to the same text (FNV-1a hash of id+field),
   so the catalog never reshuffles between page loads. Long fields are composed from
   three independent pools, so 14x14x14 = 2744 phrasings per slot rather than 14. */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- helpers */
  function hash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function pick(pool, seed) { return pool[hash(seed) % pool.length]; }
  function parts(seed, pools) { return pools.map((p, i) => pick(p, seed + '#' + i)).join(' '); }
  function uniq(arr) { return Array.from(new Set(arr.filter(Boolean))); }

  /* ------------------------------------------------------- category family */
  const FAMILIES = [
    ['physics', /physic|gravity|ragdoll|collision|ball|cloth|fluid|magnet|projectile|stack|topple/i],
    ['puzzle', /puzzle|logic|deduc|brain|word|riddle|match|sudoku|sokoban|grid|tile|mahjong|cipher|anagram|codebreak/i],
    ['idle', /idle|incremental|clicker|tycoon|automat|manage|sim|farm|city|empire|factory|colony/i],
    ['reflex', /reflex|runner|arcade|dodge|reaction|speed|one-tap|hyper|rhythm|timing|dash|endless/i],
    ['merge', /merge|combine|craft|breed|evolve|fuse|grow|chain/i],
    ['social', /social|multiplayer|party|co-?op|versus|pvp|friend|vote|chat|debate|asym/i],
    ['creative', /creative|sandbox|build|draw|paint|music|compose|design|decorate|photo|story|writing|narrative/i],
    ['strategy', /strategy|tactic|tower|defen|deck|card|turn|rogue|dungeon|auto-?battl|war|chess|puzzle-battle/i],
    ['collection', /collect|gacha|album|dex|museum|sticker|pet|companion|garden|aquarium/i],
    ['utility', /tool|tracker|habit|journal|planner|budget|note|reminder|timer|calendar|log|diet|fitness|health|sleep|money/i],
    ['knowledge', /learn|study|quiz|trivia|flash|language|teach|course|skill|practice|read/i],
    ['market', /market|shop|store|commerce|sell|trade|swap|booking|delivery|directory|listing|classified|marketplace|rent/i],
    ['community', /community|forum|review|social network|feed|dating|neighbou?r|local|club|group|mentor|match/i],
    ['data', /data|dashboard|analytic|monitor|report|insight|visual|map|chart|track|price|weather|finance|api|open/i],
    ['wellness', /wellness|mindful|medit|therapy|calm|mood|gratitude|breath|focus|adhd|anxiety/i]
  ];
  function familyOf(category) {
    for (const [name, re] of FAMILIES) if (re.test(category)) return name;
    return 'general';
  }

  /* --------------------------------------------------------------- pools */
  const P = {
    why: [
      'The pull is a near-miss loop: you fail by a hair, and the failure is legible enough that you instantly know the fix.',
      'It converts a tiny skill into visible mastery — the first attempt feels clumsy, the tenth feels like sleight of hand.',
      'Progress is continuous rather than gated, so there is never a moment where the game asks you to stop.',
      'Each run leaves a residue that carries forward, so quitting always feels like leaving value on the table.',
      'The core verb is satisfying before you understand it, which means the tutorial is the fun itself.',
      'It manufactures a "one more" reflex by keeping the retry cost under two seconds.',
      'Small decisions stack into large consequences, so the player feels authorship over outcomes.',
      'The game is generous with feedback: every input produces an immediate, exaggerated reaction.',
      'Uncertainty is tuned to sit just inside the player\'s competence, which is the textbook flow band.',
      'It gives you a score you can beat with a different strategy, not just a faster hand.',
      'Curiosity is the engine: each attempt reveals one more rule of a system you are reverse-engineering.',
      'The aesthetic reward (sound, particle, number) lands on the same frame as the achievement, fusing them.',
      'It is social by comparison rather than by requirement — a friend\'s number on the board is enough pressure.',
      'The player is always one upgrade, one unlock or one insight away from a visible jump in power.'
    ],
    whyB: [
      'Losses are cheap and informative, so frustration converts into strategy instead of resentment.',
      'There is a clean skill ceiling to chase and a low floor to start from, which keeps both beginners and veterans.',
      'Every session produces a shareable artefact — a score, a build, a route, a screenshot.',
      'The system is legible enough to plan around but noisy enough to surprise.',
      'Session length matches a bus stop, which means it fits into the cracks of a day rather than competing with them.',
      'The reward schedule mixes guaranteed small wins with rare big ones, which is the most durable shape known.',
      'Players narrate their own runs afterwards, and the narration is the retention.',
      'Mastery is visible in the world, not just in a menu — your progress changes what you see.'
    ],
    firstMinute: [
      'The first screen is playable before any text appears; the rules are discovered by touching the thing that looks touchable.',
      'Minute one hands you a single decision and shows its consequence loudly, so the mental model forms in one beat.',
      'You begin mid-action with a five-second grace window and no fail state, purely to let the feel land.',
      'The opening teaches by contrast: one safe example, then one that punishes the obvious answer.',
      'There is no menu on first launch — the first run is the tutorial and the tutorial is skippable by simply being good.',
      'The first thirty seconds give a guaranteed win so the player banks a feeling of competence before difficulty arrives.',
      'A single ghost of your own previous attempt is shown, turning the first minute into a duel with yourself.',
      'The opening poses a mystery the player can solve in under a minute, which buys permission to teach the rest.'
    ],
    session: [
      'Sessions run 45–120 seconds, which keeps the retry button psychologically free.',
      'A natural run is 2–4 minutes; the game never forces a stop, it simply makes stopping feel fine.',
      'Sessions are shaped as three escalating beats with a breather between, so the arc is felt even in a short sitting.',
      'One sitting is one "shift": a bounded chunk with a summary screen that doubles as a hook for the next one.',
      'The loop is 20 seconds long, so a two-minute session is six complete dopamine cycles.',
      'Sessions stretch naturally with skill: beginners get 40 seconds, experts get four minutes from the same ruleset.',
      'Sessions are interruptible at any frame without penalty, which is what makes it a genuine mobile habit.'
    ],
    difficulty: [
      'Difficulty rises through composition, not numbers: the same three rules combine in denser patterns.',
      'The curve is a staircase with deliberate plateaus, so the player gets to feel expert before being humbled.',
      'Difficulty is player-authored — the world gets harder only as fast as you choose to push the lever.',
      'The curve is a slow ramp with a hard spike every fifth level, which trains anticipation rather than reflexes.',
      'Difficulty scales with your own best performance, so the game is always calibrated to you and never to a stranger.',
      'The curve alternates pressure and release, using easy levels as pacing rather than filler.',
      'Failure is local: only the current attempt resets, so the curve can be steep without being punishing.'
    ],
    infinite: [
      'Endlessness comes from a seeded generator: each level is a short parameter vector (density, speed, resource budget, hazard mix) rolled from a seed, so content is unlimited but reproducible and shareable.',
      'The generator works on a grammar rather than randomness — hand-authored chunks recombined under constraints — which is why generated levels still feel designed.',
      'A daily seed gives everyone the same level, which turns an infinite supply into a shared event without needing servers.',
      'Beyond generation, difficulty is expressed as a formula rather than a table, so "level 400" is computed, not authored.',
      'Infinite mode is a separate endless track that reuses every hand-made mechanic in random order, giving veterans a treadmill that never repeats a lesson.',
      'Weekly "mutation" seeds add one new rule to the generator, so the content space keeps widening without new art.',
      'The level space is combinatorial: 6 hazards x 4 objectives x 3 terrain rules already yields 72 distinct level archetypes before scaling.',
      'A level editor plus share codes makes the content infinite in the way that matters: players author what other players play.'
    ],
    depth: [
      'Long-term depth comes from lateral unlocks: new tools change how old levels are solved rather than raising numbers.',
      'Meta-progression is a small tech tree where every node is a new verb, not a percentage.',
      'Mastery depth comes from score chasing: the same level has a safe solution and a show-off solution.',
      'A collection layer gives completionists a second axis that casual players can ignore entirely.',
      'Build variety is the depth: two players at the same level can be playing visibly different games.',
      'A weekly ladder and a personal best history give the game a reason to exist past the content wall.',
      'Depth comes from constraint stacking — optional modifiers that veterans enable to keep old content dangerous.',
      'Cosmetic self-expression carries the long tail, because the thing players protect is their own taste.'
    ],
    art: [
      'Flat vector shapes with one saturated accent against a muted field, so gameplay reads instantly on a small screen.',
      'Chunky low-poly 3D with soft studio lighting — cheap to make, expensive-looking in motion.',
      'Monochrome line art with a single colour reserved for interactive objects, which doubles as a readability system.',
      'Paper-craft textures and torn edges, giving tactile charm without a single texture artist.',
      'Neon-on-black with additive glow and heavy bloom, the aesthetic that hides simple geometry best.',
      'Soft clay / plasticine rendering with rounded silhouettes, which reads as friendly and premium at once.',
      'Pixel art at a strict 32-colour palette, which keeps asset production fast and cohesive.',
      'Risograph-style duotone with visible grain and misregistration, instantly distinctive in a store grid.',
      'Isometric miniature-diorama styling, so a small screen looks like a tabletop world.',
      'Hand-drawn ink with animated line boil, which makes even static scenes feel alive.',
      'Retro-terminal aesthetic: phosphor green on black with scanlines and monospaced type.',
      'Watercolour washes with crisp ink outlines, warm and human without being childish.'
    ],
    artB: [
      'Animation carries the personality: squash, overshoot and a 90 ms anticipation beat on every action.',
      'Palette shifts by biome, so progression is felt as colour rather than stated as a number.',
      'Everything is built from one primitive (circles, cubes, cards) so a solo dev can ship a coherent look.',
      'The UI is diegetic — numbers live in the world, not in chrome, which keeps the screen clean on mobile.',
      'Type is the illustration: oversized numerals and confident letterforms do the heavy visual lifting.',
      'A single repeating motif (a dot, a stripe, a gear) becomes the visual signature across every screen.',
      'Lighting is faked with two gradients and a vignette, which is 20 minutes of work and looks deliberate.',
      'Silhouette-first design: every object must be identifiable as a black shape before any colour is applied.'
    ],
    protoJs: [
      'Scaffold a single index.html with a full-bleed <canvas> and a 2D context; no framework, no build step.',
      'Keep all state in one plain object (entities, score, phase, seed) and write a pure update(dt) plus draw() pair.',
      'Drive it with requestAnimationFrame and a clamped delta so physics stays stable when the tab is backgrounded.',
      'Wire input as pointer events on the canvas with pointerId tracking, so one codebase covers mouse and touch.',
      'Implement level generation as a seeded PRNG (mulberry32) taking a numeric seed from the URL hash, so every level is shareable as a link.',
      'Add game feel last: 80 ms screen shake, particle burst, WebAudio blip on the same frame as the score change.',
      'Persist best score, unlocks and settings in localStorage behind a tiny save() helper.',
      'Publish by pushing the folder to GitHub Pages — it is already a static site.'
    ],
    protoGodot: [
      'New project, one Node2D scene as the game root, and a single script holding the run state machine.',
      'Model the level as data: a Resource with parameters (density, speed, budget) instantiated per level index.',
      'Use signals for decoupling — the spawner emits, the HUD listens — so mechanics can be swapped without rewiring.',
      'Do juice with Tween and AnimationPlayer rather than code, so feel is tunable by hand in the editor.',
      'Seeded generation via RandomNumberGenerator with a settable seed, stored in the save file for replay.',
      'Save with ConfigFile or a small Resource; export presets for Android and Web so one build covers both.',
      'Profile early with the built-in monitor: on mobile, draw calls matter more than triangle count.'
    ],
    protoFlutter: [
      'Create the project, then a single StatefulWidget screen holding the game state in a ChangeNotifier.',
      'Render with CustomPainter and a Ticker from SingleTickerProviderStateMixin for a clean 60 fps loop.',
      'Handle input with GestureDetector / Listener; keep hit-testing in model space, not widget space.',
      'Model levels as plain data classes generated from a seeded Random(seed) so levels are reproducible and testable.',
      'Persist with shared_preferences; keep the save schema versioned from day one.',
      'Add haptics (HapticFeedback) on key beats — on mobile it is worth more than particle effects.',
      'Use flutter_launcher_icons and a splash screen, then ship to both stores from one codebase.'
    ],
    retention: [
      'A daily seeded challenge gives a reason to open the app once a day without nagging.',
      'Streaks are shown as a physical object that visibly degrades if neglected — loss aversion without guilt-tripping.',
      'Unlocks are teased one level ahead, so the player always knows what the next session buys.',
      'Personal-best ghosts let players compete against themselves, which scales infinitely better than leaderboards.',
      'A weekly rotating modifier keeps the meta fresh for the cost of one parameter.',
      'Shareable result cards turn every good run into free acquisition.',
      'A small collection with visible empty slots creates a completion pull that is honest about the effort.',
      'Comeback mechanics: after a break, the player is handed a generous run so returning feels good.'
    ],
    money: [
      'Free with a single one-time unlock that removes ads and adds cosmetic slots — the least resented model in mobile.',
      'Cosmetics only: palettes, trails, board skins. Nothing that touches difficulty.',
      'Optional rewarded video for a second chance in a run, capped at two per session so it never becomes the design.',
      'Season pass built around cosmetic progression rather than content gates.',
      'Premium up front at a low price with a generous demo level set — the honest option if retention is uncertain.',
      'Sponsor a daily challenge with a themed cosmetic set; the sponsor gets a moment, the player gets a skin.',
      'No monetisation at all: ship it as a portfolio piece and use it to sell contract work.'
    ],
    pitfalls: [
      'Do not add a currency the player can only earn by grinding — it hides the fun behind arithmetic.',
      'Avoid a tutorial longer than the first level; teach through level one instead.',
      'Do not scale difficulty with raw speed alone; it caps your audience at the twitchy.',
      'Resist adding a second core verb before the first one is satisfying for 60 seconds.',
      'Do not ship without a two-second retry; the retry cost is the real difficulty setting.',
      'Avoid art that fights readability on a 5-inch screen at arm\'s length in daylight.',
      'Do not build servers for a single-player loop; a seed string is a free backend.',
      'Beware scope creep in the meta layer — one unlock axis is plenty for v1.',
      'Do not hide the score; the number is the motivation.'
    ],
    prior: [
      'Adjacent to existing titles in this genre, but the twist above is the differentiator — verify the specific mechanic before committing.',
      'The loop borrows a familiar verb and changes the constraint; check store search for the exact phrase before launch.',
      'Nothing here is a novel genre — the value is the specific combination. Run a store and trademark search on the name.',
      'Similar shapes exist, so plan to compete on feel, art direction and the level generator rather than on concept novelty.',
      'Treat the mechanic as the differentiator and the name as the asset: search both before you spend on art.'
    ],
    depthFamily: {
      physics: 'Depth comes from the simulation itself: the same level plays differently as your understanding of mass, momentum and friction deepens.',
      puzzle: 'Depth comes from rule interaction — early levels teach a rule, later levels require two rules solved simultaneously.',
      idle: 'Depth comes from optimising the rate of change rather than the total, which rewards rebuilds and respecs.',
      reflex: 'Depth comes from route optimisation and risk pricing, so the ceiling is strategic, not merely fast.',
      merge: 'Depth comes from board economy: knowing when to merge and when to hold is the actual skill.',
      social: 'Depth comes from reading other people, which no amount of content can exhaust.',
      creative: 'Depth comes from taste and iteration, which is why players stay long after the tool is learned.',
      strategy: 'Depth comes from build diversity and counter-play, so the meta keeps moving.',
      collection: 'Depth comes from set completion and the small stories each item carries.',
      utility: 'Depth comes from fitting the tool to a real life, which changes every month.',
      knowledge: 'Depth comes from spaced repetition and adaptive difficulty, so the app grows with the learner.',
      market: 'Depth comes from liquidity and trust: the more honest participants, the more useful it becomes.',
      community: 'Depth comes from accumulated local knowledge that no central source has.',
      data: 'Depth comes from longitudinal data: the longer you use it, the more it can tell you.',
      wellness: 'Depth comes from personalisation and honest feedback loops, not gamified streaks.',
      general: 'Depth comes from replaying the same content with a new objective, which multiplies a small content set.'
    },
    controlsPool: {
      tap: 'One-thumb tap anywhere — the entire game is playable with a hand that is also holding a coffee.',
      drag: 'Direct drag on the object itself, so the finger feels like it is physically doing the work.',
      swipe: 'Short swipes for direction, held swipe for power — two gestures, whole game.',
      tilt: 'Device tilt as the analogue input, with a tap to brake. Optional tap-only fallback for accessibility.',
      hold: 'Press-and-hold to charge, release to fire. The tension lives entirely in the hold.',
      twoThumb: 'Two-thumb landscape controls with generous hit zones and no on-screen stick.',
      typing: 'One-line text input; the keyboard is the controller.',
      voice: 'Voice input as the primary verb, with a silent alternative for public spaces.',
      camera: 'Rear camera as the input surface; the world is what is in front of you.',
      shake: 'Physical shake or a hard tap as the "impact" verb — loud, funny, immediately readable.'
    }
  };

  /* --------------------------------------------------------------- expand */
  const SEC = ['Hook', 'Core loop', 'The twist', 'Why it works', 'Levels & endlessness',
    'Controls', 'Art direction', 'First 60 seconds', 'Session & difficulty',
    'Long-term depth', 'Prototype plan', 'Retention', 'Monetisation', 'Pitfalls', 'Prior art'];

  function expand(kind, core, index) {
    const [id, title, category, stack, controls, art, hook, loop, twist, levels, spark, tagsRaw] = core;
    const tags = (tagsRaw || '').split(',').map(s => s.trim()).filter(Boolean);
    const fam = familyOf(category + ' ' + tags.join(' '));
    const s = id + '|' + title;

    const it = {
      id, kind, title, category, stack, controls, art, hook, loop, twist, levels, spark, tags,
      index,
      whyAddictive: [spark, parts(s + 'why', [P.why, P.whyB])].join(' '),
      firstMinute: parts(s + 'first', [P.firstMinute, P.whyB]),
      sessionShape: parts(s + 'sess', [P.session, P.difficulty]),
      infiniteDesign: levels + ' ' + parts(s + 'inf', [P.infinite, P.infinite]),
      depth: (P.depthFamily[fam] || P.depthFamily.general) + ' ' + parts(s + 'depth', [P.depth, P.depth]),
      artDirection: (P.artB[hash(s + 'artb') % P.artB.length]) + ' ' + parts(s + 'art', [P.art, P.art]),
      retention: uniq([parts(s + 'ret', [P.retention, P.retention])]),
      monetisation: parts(s + 'mon', [P.money, P.money]),
      pitfalls: uniq([parts(s + 'pit', [P.pitfalls, P.pitfalls])]),
      priorArt: pick(P.prior, s + 'prior'),
      controlsDetail: P.controlsPool[controls] || P.controlsPool.tap,
      prototype: (stack === 'godot' ? P.protoGodot : stack === 'flutter' ? P.protoFlutter : P.protoJs)
        .map((step, i) => step.replace(/\.$/, '') + '.')
    };

    it.tldr = it.hook;
    it.searchText = [it.id, it.title, it.category, it.stack, it.controls, it.art, it.hook, it.loop,
      it.twist, it.levels, it.spark, it.tags.join(' '), it.whyAddictive, it.infiniteDesign,
      it.depth, it.artDirection].join(' ').toLowerCase();

    it.plain = buildPlain(it);
    return it;
  }

  function buildPlain(it) {
    const L = [];
    L.push(it.title + '  [' + it.id.toUpperCase() + ' · ' + it.category + ']');
    L.push('');
    L.push('Hook: ' + it.hook);
    L.push('Core loop: ' + it.loop);
    L.push('The twist: ' + it.twist);
    L.push('Why it works: ' + it.whyAddictive);
    L.push('Levels & endlessness: ' + it.infiniteDesign);
    L.push('Controls: ' + it.controlsDetail);
    L.push('Art direction: ' + it.artDirection);
    L.push('First 60 seconds: ' + it.firstMinute);
    L.push('Session & difficulty: ' + it.sessionShape);
    L.push('Long-term depth: ' + it.depth);
    L.push('Prototype plan:');
    it.prototype.forEach((p, i) => L.push('  ' + (i + 1) + '. ' + p));
    L.push('Retention:');
    it.retention.forEach(r => L.push('  - ' + r));
    L.push('Monetisation: ' + it.monetisation);
    L.push('Pitfalls:');
    it.pitfalls.forEach(p => L.push('  - ' + p));
    L.push('Prior art: ' + it.priorArt);
    L.push('Tags: ' + it.tags.join(', '));
    return L.join('\n');
  }

  /* ------------------------------------------------------------ public API */
  const KIND_FIELDS = ['id', 'title', 'category', 'stack', 'controls', 'art', 'hook', 'loop',
    'twist', 'levels', 'spark', 'tags'];

  function build(raw, kind) {
    const out = [];
    (raw || []).forEach(line => {
      const core = String(line).split('|').map(s => s.trim());
      // tolerate a duplicated art token before spark (authoring slip, harmless)
      if (core.length === 13 && core[10] === core[5]) core.splice(10, 1);
      if (core.length < 11) { console.warn('Skipping malformed line:', line); return; }
      while (core.length < 12) core.push('');
      out.push(expand(kind, core, out.length));
    });
    return out;
  }

  window.IdeaForge = {
    build,
    fields: KIND_FIELDS,
    sections: SEC,
    familyOf,
    pool: P,
    toMarkdown(it) {
      const L = ['### ' + it.title, '', '`' + it.id.toUpperCase() + '` · **' + it.category + '** · stack: `' + it.stack + '`', '',
        '> ' + it.hook, '', '**Core loop.** ' + it.loop, '', '**The twist.** ' + it.twist, '',
        '**Why it works.** ' + it.whyAddictive, '', '**Levels & endlessness.** ' + it.infiniteDesign, '',
        '**Controls.** ' + it.controlsDetail, '', '**Art direction.** ' + it.artDirection, '',
        '**First 60 seconds.** ' + it.firstMinute, '', '**Session & difficulty.** ' + it.sessionShape, '',
        '**Long-term depth.** ' + it.depth, '', '**Prototype plan**', ''];
      it.prototype.forEach((p, i) => L.push((i + 1) + '. ' + p));
      L.push('', '**Retention**', '');
      it.retention.forEach(r => L.push('- ' + r));
      L.push('', '**Monetisation.** ' + it.monetisation, '', '**Pitfalls**', '');
      it.pitfalls.forEach(p => L.push('- ' + p));
      L.push('', '**Prior art.** ' + it.priorArt, '', '`' + it.tags.join('` `') + '`');
      return L.join('\n');
    }
  };
})();
