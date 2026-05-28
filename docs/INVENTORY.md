# Legacy site inventory

Source archive: `javelinsooperior.tar.gz` (cPanel backup, ~1.1 GB compressed; `homedir/public_html` extracts to ~590 MB).

## Stack of the legacy site

- **Laravel** PHP application (not WordPress)
- MySQL database: `javelins_funds_db.sql`
- PayPal as donation processor
- Custom admin panel (`/admin`) for content management
- Domain: `javelinfund.ca`

## Front-end pages found

`resources/views/front/pages/`:

| Slug                 | File                             | Carry forward?                |
| -------------------- | -------------------------------- | ----------------------------- |
| `/`                  | `home.blade.php`                 | Yes (rebuild)                 |
| `/about-us`          | `about-us.blade.php`             | Yes (merged with programs)    |
| `/our-programs`      | `our-programs.blade.php`         | Yes (merged with about)       |
| `/the-people`        | `the-people.blade.php`           | Yes (`team` page)             |
| `/the-people/{slug}` | `the-people-detail.blade.php`    | Optional (collapse into team) |
| `/northern-haiti`    | `northern-haiti.blade.php`       | Folded into home / programs   |
| `/news`              | `news-listings.blade.php`        | Renamed `/stories`            |
| `/news/{slug}`       | `news-listings-detail.blade.php` | Renamed `/stories/{slug}`     |
| `/media`             | `media.blade.php`                | Folded into `/stories`        |
| `/contact-us`        | `contact-us.blade.php`           | Yes                           |
| `/privacy-policy`    | `privacy-policy.blade.php`       | Yes                           |
| `/terms`             | `terms.blade.php`                | Yes                           |

## Admin (CMS) entities found

`resources/views/admin/`:

- `news/` → migrate to `src/content/stories/*.md`
- `pages/` → static markdown pages
- `our-people/` → migrate to `src/content/team/*.md`
- `administrators/` → no longer needed (Decap CMS uses GitHub auth)

## Assets

- `public/uploads/` (~309 MB) — photos uploaded via admin. WebP thumbnails + originals.
- `public/assets/images/` — site UI assets, hero banners, logo, illustrations.
  - Hero candidates: `banner.jpg`, `Banner -1.jpg`, `banner - 2.jpg`, `haiti.jpg`
  - Story / portrait photos: `family-1.jpg` … `family-6.jpg`
  - Brand: `Javelin-logo.png`, `logo-footer.png`
  - Topic: `education-min.png`, `health-min.png`, `social assistance.png`, `With community support, disabled girl is able to get a wheelchair.jpg`

## Migration plan

1. Parse `mysql/javelins_funds_db.sql` → extract `news`, `pages`, `our_people` rows.
2. Convert each row to a markdown file with frontmatter (`title`, `slug`, `date`, `featured`, `priority`, `hero_image`).
3. Copy referenced images from `public/uploads/` and `public/assets/images/` into `src/assets/` (Astro image optimization pipeline).
4. Manually rewrite the home hero, programs intro, and donate copy in the new "bold activist" voice.

## Constraints captured during brainstorm

- **No stock photos.** Only Javelin Fund's own photography. Ask the user before substituting.
- **English only** for phase 1. French motto band ("L'union fait la force") retained as cultural anchor only.
- **325 children** currently in school.
- **CanadaHelps** is the only card processor (issues CRA receipts automatically).
- **Interac e-Transfer** to `donate@javelinfund.ca` documented on `/donate` (manual reconcile).
- Featured story and featured donate tiers are **dynamic at build time**: markdown frontmatter `featured: true` plus `priority` integer; homepage auto-renders.
- Charity number: **BN 755722097 RR0001**, founded **2016**.
