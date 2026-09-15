import { randomUUID } from "node:crypto";
import { catalog } from "./catalog.js";

// Seed decks for the shared library. Without these, Discover opens empty
// and the upvoting, filtering and sorting have nothing to act on.
// Vote counts are spread unevenly on purpose so ranking is legible.
const day = 86_400_000;
const seeds = [
  {
    title: "Spanish verbs for real conversations",
    description: "The forty verbs you actually reach for when speaking.",
    category: "Languages",
    color: "peach",
    author: "María R.",
    votes: 342,
    saves: 1210,
    age: 34,
    cards: [
      ["ser", "to be — permanent traits, identity, origin"],
      ["estar", "to be — location, temporary state, feeling"],
      ["tener", "to have; also for age (tengo 20 años)"],
      ["hacer", "to do, to make; weather (hace frío)"],
      ["poder", "to be able to, can"],
      ["querer", "to want; to love (a person)"],
      ["saber", "to know a fact or how to do something"],
      ["conocer", "to know a person or be familiar with a place"],
      ["ir", "to go; ir a + infinitive = going to (future)"],
      ["venir", "to come"],
      ["decir", "to say, to tell"],
      ["llevar", "to carry, to wear; to have been (time)"],
    ],
  },
  {
    title: "Cell biology essentials",
    description: "Organelles, membranes and respiration without the padding.",
    category: "Science",
    color: "sage",
    author: "Dr. N. Kulkarni",
    votes: 287,
    saves: 964,
    age: 21,
    cards: [
      [
        "What does the mitochondrion do?",
        "Produces ATP through aerobic respiration.",
      ],
      [
        "Function of the rough ER?",
        "Synthesises and folds proteins; studded with ribosomes.",
      ],
      [
        "Function of the smooth ER?",
        "Lipid synthesis, detoxification, calcium storage.",
      ],
      [
        "What does the Golgi apparatus do?",
        "Modifies, sorts and packages proteins for transport.",
      ],
      [
        "Role of lysosomes?",
        "Contain digestive enzymes that break down waste.",
      ],
      [
        "What makes the membrane selectively permeable?",
        "The phospholipid bilayer — nonpolar core blocks ions and large polar molecules.",
      ],
      [
        "Net ATP from glycolysis?",
        "2 ATP (4 produced, 2 invested) plus 2 NADH.",
      ],
      ["Where does the Krebs cycle occur?", "The mitochondrial matrix."],
      [
        "What is the final electron acceptor in aerobic respiration?",
        "Oxygen, forming water.",
      ],
      [
        "Difference between prokaryotic and eukaryotic cells?",
        "Eukaryotes have a nucleus and membrane-bound organelles; prokaryotes do not.",
      ],
    ],
  },
  {
    title: "CSS Grid, properly understood",
    description: "Stop guessing at layout. Learn the actual model.",
    category: "Technology",
    color: "blue",
    author: "Yuki T.",
    votes: 261,
    saves: 878,
    age: 12,
    cards: [
      [
        "display: grid vs inline-grid?",
        "Both create a grid container; inline-grid flows inline with surrounding text.",
      ],
      [
        "What does 1fr mean?",
        "One fraction of the remaining free space after fixed tracks are placed.",
      ],
      [
        "What does minmax(200px, 1fr) do?",
        "Track never shrinks below 200px, but grows to fill free space.",
      ],
      [
        "Purpose of auto-fit vs auto-fill?",
        "auto-fit collapses empty tracks; auto-fill keeps them, leaving gaps.",
      ],
      [
        "How do you name a grid area?",
        "grid-template-areas on the container, grid-area on the child.",
      ],
      [
        "Difference between justify-items and align-items?",
        "justify-items is inline (row) axis; align-items is block (column) axis.",
      ],
      [
        "What is an implicit grid?",
        "Tracks the browser creates for items placed outside your explicit template.",
      ],
      [
        "How do you span three columns?",
        "grid-column: span 3, or an explicit line range like 1 / 4.",
      ],
    ],
  },
  {
    title: "Design principles that hold up",
    description: "Hierarchy, contrast and rhythm, explained through use.",
    category: "Design",
    color: "lilac",
    author: "Ana P.",
    votes: 198,
    saves: 655,
    age: 45,
    cards: [
      [
        "What is visual hierarchy?",
        "Arranging elements so size, contrast and position signal relative importance.",
      ],
      [
        "Why does whitespace matter?",
        "It groups related items and gives the eye a resting point, reducing load.",
      ],
      [
        "What is the 60-30-10 rule?",
        "A colour split: 60% dominant, 30% secondary, 10% accent.",
      ],
      [
        "Define optical alignment.",
        "Adjusting by eye rather than by maths, because measured centres can look off.",
      ],
      [
        "What is a modular scale?",
        "A ratio-based type scale so sizes relate rather than being arbitrary.",
      ],
      [
        "Why limit typefaces?",
        "Each adds visual noise; two well-paired families usually carry a whole system.",
      ],
      [
        "What does contrast accomplish?",
        "It directs attention and makes structure readable at a glance.",
      ],
    ],
  },
  {
    title: "Mental models for clearer thinking",
    description: "Reusable frames for decisions under uncertainty.",
    category: "Learning science",
    color: "yellow",
    author: "Ravi S.",
    votes: 176,
    saves: 590,
    age: 8,
    cards: [
      [
        "What is second-order thinking?",
        "Asking 'and then what?' — considering the consequences of consequences.",
      ],
      [
        "Explain inversion.",
        "Solve forward and backward: ask what would guarantee failure, then avoid it.",
      ],
      [
        "What is the map/territory distinction?",
        "A model is a simplification; never mistake it for the reality it describes.",
      ],
      [
        "Define opportunity cost.",
        "The value of the best alternative you gave up by choosing this.",
      ],
      [
        "What is Hanlon's razor?",
        "Don't attribute to malice what is adequately explained by carelessness.",
      ],
      [
        "What is confirmation bias?",
        "Favouring evidence that supports what you already believe.",
      ],
      [
        "Describe the circle of competence.",
        "Know the boundary of what you genuinely understand, and act inside it.",
      ],
    ],
  },
  {
    title: "Statistics you can't fake",
    description: "The concepts that decide whether a result means anything.",
    category: "Science",
    color: "sage",
    author: "Priya M.",
    votes: 154,
    saves: 512,
    age: 17,
    cards: [
      [
        "What does a p-value actually tell you?",
        "The probability of data this extreme if the null hypothesis were true — not the chance the hypothesis is false.",
      ],
      [
        "Difference between correlation and causation?",
        "Correlation is co-movement; causation requires intervention or strong design to establish.",
      ],
      [
        "What is statistical power?",
        "The probability of detecting a real effect when one exists; low power misses true effects.",
      ],
      [
        "Explain the central limit theorem.",
        "Sample means approach a normal distribution as sample size grows, whatever the source distribution.",
      ],
      [
        "What is Simpson's paradox?",
        "A trend that appears in groups but reverses when those groups are combined.",
      ],
      [
        "Why report confidence intervals?",
        "They show the size and precision of an effect, not just whether it cleared a threshold.",
      ],
    ],
  },
  {
    title: "French pronunciation survival kit",
    description: "The sounds that trip up English speakers most.",
    category: "Languages",
    color: "peach",
    author: "Claire D.",
    votes: 132,
    saves: 447,
    age: 29,
    cards: [
      [
        "How is the French 'r' produced?",
        "In the back of the throat (uvular), not with the tongue tip.",
      ],
      [
        "What is liaison?",
        "Pronouncing a normally silent final consonant when the next word starts with a vowel.",
      ],
      [
        "Which final consonants are usually silent?",
        "Most — especially s, t, d, x, z. C, r, f and l are often sounded.",
      ],
      [
        "Difference between 'u' and 'ou'?",
        "'u' is rounded lips with a front tongue (tu); 'ou' is a back vowel (vous).",
      ],
      [
        "What are nasal vowels?",
        "Vowels with air through the nose — on, an, in — with no following consonant sound.",
      ],
    ],
  },
  {
    title: "Git commands worth memorising",
    description: "Everyday workflow, plus the recovery commands.",
    category: "Technology",
    color: "blue",
    author: "Tom B.",
    votes: 118,
    saves: 401,
    age: 5,
    cards: [
      ["Undo the last commit but keep the changes?", "git reset --soft HEAD~1"],
      [
        "Discard all local changes to a file?",
        "git checkout -- <file>, or git restore <file>",
      ],
      [
        "What does git stash do?",
        "Shelves uncommitted changes so you can switch context, restored with git stash pop.",
      ],
      [
        "Difference between merge and rebase?",
        "Merge preserves history and adds a commit; rebase replays your commits onto a new base for a linear history.",
      ],
      [
        "How do you recover a deleted branch?",
        "Find the SHA with git reflog, then git branch <name> <sha>.",
      ],
      [
        "What does git cherry-pick do?",
        "Applies a single commit from another branch onto the current one.",
      ],
    ],
  },
  {
    title: "Music theory foundations",
    description: "Intervals, scales and chords from first principles.",
    category: "Music",
    color: "lilac",
    author: "Sam O.",
    votes: 97,
    saves: 318,
    age: 40,
    cards: [
      ["How many semitones in a perfect fifth?", "Seven."],
      ["Formula for a major scale?", "W-W-H-W-W-W-H (whole and half steps)."],
      [
        "What makes a chord minor?",
        "A minor third — three semitones — between root and the middle note.",
      ],
      [
        "What is a key signature?",
        "The sharps or flats at the staff's start, defining the key.",
      ],
      [
        "Define an inversion.",
        "A chord voiced with a note other than the root in the bass.",
      ],
      [
        "What is the circle of fifths?",
        "Keys arranged by fifths, showing their signatures and closest relations.",
      ],
    ],
  },
  {
    title: "Everyday physics intuitions",
    description: "Why ordinary things behave the way they do.",
    category: "Science",
    color: "sage",
    author: "Ishan V.",
    votes: 86,
    saves: 287,
    age: 26,
    cards: [
      [
        "Why do you feel pushed outward on a turn?",
        "Inertia — your body continues straight while the car turns; there is no outward force.",
      ],
      [
        "Why is the sky blue?",
        "Rayleigh scattering — shorter blue wavelengths scatter far more than red.",
      ],
      [
        "Why does ice float?",
        "Water expands when it freezes, so ice is less dense than liquid water.",
      ],
      [
        "Why does a heavier object not fall faster?",
        "Gravitational acceleration is independent of mass; in air, drag creates the difference.",
      ],
      [
        "What keeps a satellite in orbit?",
        "It is continuously falling toward Earth while moving sideways fast enough to keep missing.",
      ],
    ],
  },
  {
    title: "Negotiation, without the theatre",
    description: "Preparation and framing that actually move outcomes.",
    category: "Business",
    color: "yellow",
    author: "Neha G.",
    votes: 74,
    saves: 241,
    age: 14,
    cards: [
      [
        "What is a BATNA?",
        "Best Alternative To a Negotiated Agreement — your walk-away option, and your real leverage.",
      ],
      [
        "Why anchor first?",
        "The opening number disproportionately shapes the range that follows.",
      ],
      [
        "What is the difference between position and interest?",
        "A position is what someone demands; the interest is why they want it — trades live in the why.",
      ],
      [
        "Why use silence?",
        "It invites the other side to fill the gap, often with information or a concession.",
      ],
      [
        "What is a ZOPA?",
        "Zone Of Possible Agreement — the overlap between both sides' acceptable ranges.",
      ],
    ],
  },
  {
    title: "Japanese hiragana, fast",
    description: "All 46 base characters with memory hooks.",
    category: "Languages",
    color: "peach",
    author: "Kenji A.",
    votes: 63,
    saves: 205,
    age: 3,
    cards: [
      ["あ", "a — like the 'a' in father"],
      ["い", "i — like the 'ee' in see"],
      ["う", "u — like the 'oo' in food, lips relaxed"],
      ["え", "e — like the 'e' in bed"],
      ["お", "o — like the 'o' in or"],
      ["か", "ka"],
      ["き", "ki"],
      ["く", "ku"],
      ["さ", "sa"],
      ["し", "shi — not 'si'"],
    ],
  },
  {
    title: "Typography for screens",
    description: "Setting readable text in a medium you can't control.",
    category: "Design",
    color: "lilac",
    author: "Ana P.",
    votes: 58,
    saves: 190,
    age: 19,
    cards: [
      [
        "Ideal line length for body text?",
        "Roughly 45-75 characters; beyond that the eye loses the line return.",
      ],
      [
        "What is leading?",
        "The space between lines — around 1.4-1.6× the font size for body copy.",
      ],
      [
        "When should you use letter-spacing?",
        "Tighten large display type; open up small caps and all-caps runs.",
      ],
      [
        "Why avoid pure black on white?",
        "The contrast can cause halation; a very dark grey reads more comfortably.",
      ],
      [
        "What is a widow?",
        "A single word stranded on its own line at the end of a paragraph.",
      ],
    ],
  },
  {
    title: "Microeconomics in one sitting",
    description: "Supply, demand, elasticity and market failure.",
    category: "Business",
    color: "yellow",
    author: "Arjun K.",
    votes: 41,
    saves: 138,
    age: 11,
    cards: [
      [
        "What is price elasticity of demand?",
        "The percentage change in quantity demanded per percentage change in price.",
      ],
      [
        "What is a sunk cost?",
        "A cost already spent and unrecoverable — it should not affect future decisions.",
      ],
      [
        "Define marginal utility.",
        "The additional satisfaction from consuming one more unit; it typically diminishes.",
      ],
      [
        "What is a public good?",
        "Non-rival and non-excludable — one person's use doesn't reduce another's, and you can't easily exclude anyone.",
      ],
      [
        "What causes deadweight loss?",
        "Trades that would have benefited both sides fail to happen, often from a tax, price floor or monopoly.",
      ],
    ],
  },
  {
    title: "Sleep, memory and the night shift",
    description: "What consolidation actually needs from you.",
    category: "Learning science",
    color: "sage",
    author: "Dr. L. Feldman",
    votes: 29,
    saves: 94,
    age: 2,
    cards: [
      [
        "What happens to memory during deep sleep?",
        "Hippocampal traces are replayed and transferred toward cortical long-term storage.",
      ],
      [
        "Why does cramming fail?",
        "Without sleep between sessions, consolidation never happens and retention collapses within days.",
      ],
      [
        "What is the spacing effect?",
        "Distributed practice produces far stronger retention than the same total time massed together.",
      ],
      [
        "Does REM or deep sleep matter for facts?",
        "Slow-wave (deep) sleep is most associated with declarative memory; REM supports procedural and emotional.",
      ],
      [
        "Best time to review before sleep?",
        "Reviewing shortly before sleeping can improve overnight consolidation of that material.",
      ],
    ],
  },
];

export function seedSharedDecks(db) {
  const existing = db
    .prepare("SELECT count(*) AS n FROM shared_decks WHERE seeded=1")
    .get().n;
  if (existing > 0) return 0;
  const now = Date.now();
  const insert = db.prepare(
    "INSERT INTO shared_decks (id,deck_id,user_id,author,title,description,category,color,cards,card_count,votes,saves,seeded,created) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?)",
  );
  db.transaction(() => {
    // The original starter collections keep their slug ids so their
    // permalinks (/discover/design) keep working now that Discover is
    // backed by the shared library rather than the static catalog.
    for (const [index, deck] of catalog.entries()) {
      const cards = deck.cards.map(([front, back]) => ({ front, back }));
      insert.run(
        deck.id,
        null,
        null,
        "Memify",
        deck.title,
        deck.description,
        deck.category,
        deck.color,
        JSON.stringify(cards),
        cards.length,
        120 - index * 7,
        380 - index * 30,
        now - (60 + index) * day,
      );
    }
    for (const s of seeds) {
      const cards = s.cards.map(([front, back]) => ({ front, back }));
      insert.run(
        randomUUID(),
        null,
        null,
        s.author,
        s.title,
        s.description,
        s.category,
        s.color,
        JSON.stringify(cards),
        cards.length,
        s.votes,
        s.saves,
        now - s.age * day,
      );
    }
  })();
  return seeds.length + catalog.length;
}

export const seedCategories = [...new Set(seeds.map((s) => s.category))];
