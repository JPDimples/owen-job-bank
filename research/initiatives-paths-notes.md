# Owen's Job Bank — Research notes: after-school initiatives & career paths

Checked 2026-11-16. All sources are the organisations' own pages or official directories
found via search and, where stated, opened in full. Nothing here was invented:
every wage, age, deadline and address carries its source in the JSON files.

## What was verified

- **Clarington Youth Centres (Firehouse / Loft / NYC)** — free drop-in, ages 12–19
  (JHS) / 12–18 (CYC page). The Firehouse is in Bowmanville itself. Best
  genuinely local, free, teen after-school option found.
- **Clarington Public Library** — teen programs, TAG and student volunteering
  confirmed by opening the CPLMA page. Student Page job is real but the
  posting found is expired (July 2025, $17.20/hr, Grade 9 minimum).
- **Town of Clarington recreation** — Bowmanville Community Complex opened
  Oct 2026; teen fitness 13+, membership prices published to Dec 31, 2026.
- **Clarington lifeguard/instructor courses** — full chain verified by opening
  the page: Bronze Star 10–12 → Bronze Medallion 13+ → First Aid →
  Bronze Cross → National Lifeguard 15+, plus Swim Instructor 15+.
  Assistant Lifeguard jobs need Bronze Cross and age 15.
- **BGC Durham** — after-school program (younger kids, Clarington sites at
  John M. James PS and Diane Hamre, Newcastle) and teen evening programs
  (Northview, Oshawa, ages 13–18) confirmed. No BGC teen site in Bowmanville
  was found.
- **Employment help in/near Bowmanville** — Durham College Employment
  Services (219 King St E, Bowmanville, free); Agilec Employable YOU
  ages 15–30 (Courtice, paid placement); YMCA GTA Employment Services
  (Pickering — nearest office; none in Bowmanville).
- **Cadets in Bowmanville** — 172 Air Cadets (Bowmanville High School,
  Tue 6:30–9pm, ages 12–18) and Sea Cadets (47 Liberty St N, Wed 6:30–9:15pm,
  ages 12–18) confirmed via their own/listing pages.
- **Career paths** — aquatics and OYAP are the most solidly sourced
  (Clarington page; YRDSB/PVNCCDSB OYAP pages). Retail and grocery ladders
  are verified at the role-title level from Walmart Canada and Loblaw/No
  Frills careers pages; all timelines are labelled general guidance.
  Camp counsellor ages (16+, Standard First Aid/CPR-C) are verified from
  Clarington postings and a comparable Ontario municipality.

## What could NOT be confirmed

- **BGC Durham current Clarington site list and fees.** The program page
  does not publish fees or a current site list; site names come from a 2024
  job posting and a KPRDSB page. Confirm with BGC (905-728-5121) before
  publishing a site list.
- **YMCA teen provision in Bowmanville.** The only YMCA program actually
  in Bowmanville is before/after-school care for Kindergarten–Grade 6.
  The nearest YMCA teen/fitness provision is Oshawa YMCA (99 Mary St N).
  Membership prices were not confirmed from the pages checked.
- **Student Page / TAG availability.** TAG Bowmanville & Courtice were FULL
  as of October 2026 (per CPLMA page). The Student Page posting is expired;
  no live vacancy was confirmed on 2026-11-16.
- **Clarington part-time vacancies.** The careers page lists role types
  (350+ part-time staff), not live openings. One March Break Inclusion
  Counsellor posting (to Dec 11, 2026) was seen in search — verify on
  clarington.net/careers before listing it.
- **Cadet costs.** Air Cadets is publicly funded/no direct cost per other
  squadrons' FAQs, but 172 Squadron's own cost was not confirmed; Sea
  Cadets cost was not confirmed at all.
- **CYC age upper limit.** Sources disagree (12–18 vs 12–19); both are
  recorded in the JSON.
- **Customer service → sales path** is marked `verified: false` in
  career-paths.json — no employer was found publishing that progression
  with timelines; it is general guidance only.
- **OYAP in Durham specifically.** The program is province-wide and the
  structure is verified, but no DDSB/KPRDSB OYAP page was opened. Owen
  must confirm with his own school's co-op teacher.

## Dead ends / things deliberately NOT included

- **DurhamWorks (durhamworks.info)** — despite the name, this is County
  Durham, England, not Durham Region, Ontario. Excluded.
- **Scouts Canada / other youth groups in Bowmanville** — not verified in
  the time available; not included rather than guessed.
- **Wages quoted in third-party round-ups** (e.g. gig/stampguider,
  jobflexy) for Walmart roles — not used; only employer careers pages
  and named postings were used.
- **No Frills Bowmanville wage** — the $17.95–$18.45 Grocery Clerk range
  is from a specific Loblaw posting, not a Bowmanville posting. It is
  flagged as such in career-paths.json; do not present it as the
  Bowmanville wage.
- **YMCA GTA "Teen Night"** — mentioned in a volunteer listing for
  Oshawa; schedule and cost not confirmed.

## Files

- `initiatives.json` — 15 entries (includes one explicit NOT-for-teens
  entry, the YMCA before/after-school program, and the Clarington
  part-time jobs page as an initiative).
- `career-paths.json` — 6 paths: retail, grocery, aquatics, OYAP trades,
  recreation/camp counsellor, customer service → sales.
- All entries carry `checked_date: 2026-11-16`, a `source_url`, and a
  `verified` flag. Anything unverified is marked in `notes`, not
  silently presented as fact.
