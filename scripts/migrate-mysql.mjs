// scripts/migrate-mysql.mjs
//
// One-shot migrator: MySQL dump -> Astro markdown content collections.
//
// - Reads `_source/extracted/javelinsooperior/mysql/javelins_funds_db.sql`
// - Extracts INSERT rows from tables `news` and `our_people`
// - Writes one markdown file per row into `src/content/stories/` and
//   `src/content/team/` respectively, copying referenced images into
//   `src/assets/images/`.
// - Skips rows whose slug already exists on disk (preserves curated seeds).
// - Skips rows whose referenced image is missing on disk (no stock images).
//
// Run with: node scripts/migrate-mysql.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import slugify from 'slugify';
import YAML from 'yaml';
import { parse as parseHtml } from 'node-html-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const DUMP = path.join(ROOT, '_source/extracted/javelinsooperior/mysql/javelins_funds_db.sql');
const PUBLIC_ROOT = path.join(
  ROOT,
  '_source/extracted/javelinsooperior/homedir/public_html/public',
);
const IMAGE_SEARCH_DIRS = [
  path.join(PUBLIC_ROOT, 'uploads/front'),
  path.join(PUBLIC_ROOT, 'uploads/admin'),
  path.join(PUBLIC_ROOT, 'uploads/thumbnail_image'),
  path.join(PUBLIC_ROOT, 'uploads'),
  path.join(PUBLIC_ROOT, 'assets/images'),
];

const OUT_IMAGES = path.join(ROOT, 'src/assets/images');
const OUT_STORIES = path.join(ROOT, 'src/content/stories');
const OUT_TEAM = path.join(ROOT, 'src/content/team');

fs.mkdirSync(OUT_IMAGES, { recursive: true });
fs.mkdirSync(OUT_STORIES, { recursive: true });
fs.mkdirSync(OUT_TEAM, { recursive: true });

const sql = fs.readFileSync(DUMP, 'utf8');

/**
 * Extract every tuple from every `INSERT INTO \`<table>\` ... VALUES (...),(...);`
 * statement for the given table. Returns the raw inside of each tuple's parens.
 */
function extractTuplesForTable(sqlText, table) {
  // Find all INSERT statements (may be more than one) for this table.
  const headerRe = new RegExp(`INSERT INTO\\s+\`${table}\`[^;]*?VALUES\\s*`, 'gi');
  const tuples = [];
  let m;
  while ((m = headerRe.exec(sqlText)) !== null) {
    // Walk forward from end of header, collecting tuples until we hit `;`.
    let i = m.index + m[0].length;
    while (i < sqlText.length) {
      // Skip whitespace and commas between tuples.
      while (i < sqlText.length && /[\s,]/.test(sqlText[i])) i++;
      if (sqlText[i] === ';') {
        i++;
        break;
      }
      if (sqlText[i] !== '(') break;
      // Parse one tuple — respect string literals with `\\` and `\'` escapes.
      i++; // step past '('
      const start = i;
      let inStr = false;
      while (i < sqlText.length) {
        const c = sqlText[i];
        if (inStr) {
          if (c === '\\') {
            i += 2;
            continue;
          }
          if (c === "'") {
            inStr = false;
            i++;
            continue;
          }
          i++;
          continue;
        }
        if (c === "'") {
          inStr = true;
          i++;
          continue;
        }
        if (c === ')') break;
        i++;
      }
      tuples.push(sqlText.slice(start, i));
      i++; // step past ')'
    }
  }
  return tuples;
}

/**
 * Split a tuple body into its comma-separated MySQL values, respecting
 * single-quoted strings and `\\` / `\'` escapes. Returns JS-typed values:
 *   numeric -> Number, NULL -> null, quoted string -> decoded string.
 */
function parseTuple(t) {
  const out = [];
  let i = 0;
  while (i < t.length) {
    while (i < t.length && /\s/.test(t[i])) i++;
    if (i >= t.length) break;
    if (t[i] === "'") {
      // String literal.
      i++;
      let s = '';
      while (i < t.length) {
        const c = t[i];
        if (c === '\\') {
          const n = t[i + 1];
          if (n === 'n') s += '\n';
          else if (n === 'r') s += '\r';
          else if (n === 't') s += '\t';
          else if (n === '0') s += '\0';
          else if (n === '\\') s += '\\';
          else if (n === "'") s += "'";
          else if (n === '"') s += '"';
          else s += n ?? '';
          i += 2;
          continue;
        }
        if (c === "'") {
          // SQL doubles single quotes for escaping inside a string.
          if (t[i + 1] === "'") {
            s += "'";
            i += 2;
            continue;
          }
          break;
        }
        s += c;
        i++;
      }
      i++; // past closing '
      out.push(s);
    } else {
      // Bareword token: number, NULL, etc.
      let v = '';
      while (i < t.length && t[i] !== ',') {
        v += t[i];
        i++;
      }
      v = v.trim();
      if (/^NULL$/i.test(v)) out.push(null);
      else if (/^-?\d+(\.\d+)?$/.test(v)) out.push(Number(v));
      else out.push(v);
    }
    while (i < t.length && /\s/.test(t[i])) i++;
    if (t[i] === ',') i++;
  }
  return out;
}

/**
 * Strip leading/trailing whitespace and `&nbsp;`, decode common HTML entities,
 * then convert tags to markdown (very light — paragraphs, line breaks,
 * lists, basic emphasis).
 */
function htmlToMarkdown(html) {
  if (!html) return '';
  const root = parseHtml(html);

  const decode = (s) =>
    s
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&rsquo;/gi, '’')
      .replace(/&lsquo;/gi, '‘')
      .replace(/&ldquo;/gi, '“')
      .replace(/&rdquo;/gi, '”')
      .replace(/&hellip;/gi, '…')
      .replace(/&mdash;/gi, '—')
      .replace(/&ndash;/gi, '–');

  const walk = (node) => {
    if (node.nodeType === 3) return decode(node.rawText ?? '');
    const tag = node.rawTagName?.toLowerCase();
    const inner = (node.childNodes ?? []).map(walk).join('');
    switch (tag) {
      case 'p':
      case 'div':
        return `\n\n${inner.trim()}\n\n`;
      case 'br':
        return '\n';
      case 'strong':
      case 'b':
        return `**${inner}**`;
      case 'em':
      case 'i':
        return `*${inner}*`;
      case 'ul':
      case 'ol':
        return `\n${inner}\n`;
      case 'li':
        return `- ${inner.trim()}\n`;
      case 'a': {
        const href = node.getAttribute?.('href');
        return href ? `[${inner}](${href})` : inner;
      }
      case 'h1':
        return `\n\n# ${inner.trim()}\n\n`;
      case 'h2':
        return `\n\n## ${inner.trim()}\n\n`;
      case 'h3':
        return `\n\n### ${inner.trim()}\n\n`;
      case 'img':
      case 'script':
      case 'style':
        return '';
      default:
        return inner;
    }
  };

  let md = walk(root);
  // Collapse 3+ blank lines, trim, normalize spaces.
  md = md
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return md;
}

/** Build an excerpt from html: first ~200 chars of plaintext. */
function htmlToExcerpt(html, fallback) {
  if (!html) return fallback ?? '';
  const text = parseHtml(html).text.replace(/\s+/g, ' ').trim();
  if (!text) return fallback ?? '';
  const limit = 240;
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const last = cut.lastIndexOf(' ');
  return (last > 80 ? cut.slice(0, last) : cut).trim() + '…';
}

function makeSlug(s) {
  const out = slugify(s, { lower: true, strict: true, locale: 'en' });
  return out || 'untitled';
}

function findSourceImage(filename) {
  if (!filename) return null;
  const base = path.basename(filename);
  for (const dir of IMAGE_SEARCH_DIRS) {
    const p = path.join(dir, base);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function copyImage(srcPath, destName) {
  const dest = path.join(OUT_IMAGES, destName);
  if (!fs.existsSync(dest)) {
    fs.copyFileSync(srcPath, dest);
  }
  return dest;
}

function frontmatterBlock(obj) {
  // YAML emits dates as ISO timestamps; we want plain YYYY-MM-DD strings, so
  // pre-format date fields ourselves.
  return `---\n${YAML.stringify(obj, { lineWidth: 0 }).trim()}\n---\n`;
}

function fmtDate(d) {
  // d may be a string 'YYYY-MM-DD' or a Date — return 'YYYY-MM-DD'.
  if (!d) return null;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  const s = String(d).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

// ---------- migrate `news` -> stories ----------

const stats = {
  storiesWritten: 0,
  storiesSkippedExisting: 0,
  storiesSkippedMissingImage: 0,
  teamWritten: 0,
  teamSkippedExisting: 0,
  teamSkippedMissingImage: 0,
  imagesCopied: 0,
};

function migrateStories() {
  const tuples = extractTuplesForTable(sql, 'news');
  console.log(`[stories] found ${tuples.length} rows in \`news\``);
  for (const t of tuples) {
    const cols = parseTuple(t);
    // news: id, news_title, news_sub_title, news_date, image, home_image,
    //       news_content, home_page_slider, front_page, created_at, updated_at
    const [
      id,
      title,
      subTitle,
      newsDate,
      image,
      homeImage,
      content,
      homePageSlider,
      _frontPage,
      createdAt,
      _updatedAt,
    ] = cols;

    if (!title) {
      console.warn(`[stories] row ${id}: missing title, skipping`);
      continue;
    }

    const slug = makeSlug(String(title));
    const outPath = path.join(OUT_STORIES, `${slug}.md`);

    if (fs.existsSync(outPath)) {
      console.log(`[stories] ${slug}: skipped (exists, preserving seed)`);
      stats.storiesSkippedExisting++;
      continue;
    }

    // Pick best image: prefer `home_image` if set & exists, otherwise `image`.
    const candidates = [homeImage, image].filter(Boolean);
    let resolved = null;
    let resolvedSrc = null;
    for (const c of candidates) {
      const src = findSourceImage(c);
      if (src) {
        resolved = c;
        resolvedSrc = src;
        break;
      }
    }
    if (!resolvedSrc) {
      console.warn(
        `[stories] ${slug}: missing image (looked for ${candidates.join(', ')}), skipping`,
      );
      stats.storiesSkippedMissingImage++;
      continue;
    }

    const ext = path.extname(resolved).toLowerCase() || '.webp';
    const imgName = `story-${slug}${ext}`;
    copyImage(resolvedSrc, imgName);
    stats.imagesCopied++;

    const dateStr = fmtDate(newsDate) ?? fmtDate(createdAt) ?? '2023-01-01';

    const excerpt = subTitle?.trim() || htmlToExcerpt(content, title);

    const fm = {
      title: String(title).trim(),
      excerpt: String(excerpt).trim(),
      date: dateStr,
      hero: `../../assets/images/${imgName}`,
      featured: false,
      priority: homePageSlider ? 50 : 0,
      tags: [],
    };

    const body = htmlToMarkdown(content) || excerpt;
    const md = `${frontmatterBlock(fm)}\n${body}\n`;
    fs.writeFileSync(outPath, md);
    stats.storiesWritten++;
    console.log(`[stories] ${slug}: written`);
  }
}

// ---------- migrate `our_people` -> team ----------

function migrateTeam() {
  const tuples = extractTuplesForTable(sql, 'our_people');
  console.log(`[team] found ${tuples.length} rows in \`our_people\``);
  let order = 10;
  for (const t of tuples) {
    const cols = parseTuple(t);
    // our_people: id, title, sub_title, date, image, content, created_at, updated_at
    const [id, title, subTitle, _date, image, content] = cols;

    if (!title) {
      console.warn(`[team] row ${id}: missing title, skipping`);
      continue;
    }

    const slug = makeSlug(String(title));
    const outPath = path.join(OUT_TEAM, `${slug}.md`);

    if (fs.existsSync(outPath)) {
      console.log(`[team] ${slug}: skipped (exists, preserving seed)`);
      stats.teamSkippedExisting++;
      continue;
    }

    const src = findSourceImage(image);
    if (!src) {
      console.warn(`[team] ${slug}: missing image (${image}), skipping`);
      stats.teamSkippedMissingImage++;
      continue;
    }

    const ext = path.extname(image).toLowerCase() || '.webp';
    const imgName = `team-${slug}${ext}`;
    copyImage(src, imgName);
    stats.imagesCopied++;

    const role = (subTitle && String(subTitle).trim()) || 'Community member';
    const bio = htmlToExcerpt(content, role);

    const fm = {
      name: String(title).trim(),
      role,
      photo: `../../assets/images/${imgName}`,
      order: order++,
      bio,
    };

    const body = htmlToMarkdown(content) || bio;
    const md = `${frontmatterBlock(fm)}\n${body}\n`;
    fs.writeFileSync(outPath, md);
    stats.teamWritten++;
    console.log(`[team] ${slug}: written`);
  }
}

migrateStories();
migrateTeam();

console.log('\n--- migration summary ---');
console.log(JSON.stringify(stats, null, 2));
