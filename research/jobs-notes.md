# Owen's Job Bank — Research Notes (2026-11-17)

## Totals

- **Total postings in `jobs.json`: 31**
- **Verified from the source page itself (opened and read in full): 12**
- **Unverified (search-snippet / aggregator-mirror only, posting page not opened): 19**
- Verification rule used: `verified: true` only when the posting page itself was opened with `browser.open` and read on 2026-11-16 or 2026-11-17. Anything sourced from a search-result snippet is `verified: false`, with that stated in its `notes` field.

## Per-town counts

| Town | Postings | Verified |
|---|---|---|
| Bowmanville | 17 | 9 |
| Oshawa | 5 | 2 |
| Whitby | 3 | 1 |
| Courtice | 2 | 0 |
| Ajax | 2 | 0 |
| Newcastle | 1 | 0 |
| Pickering | 1 | 0 |
| Orono | 0 | 0 |

## Best bets (verified, no experience, after-school friendly)

1. **Walmart Electronics Associate, Bowmanville** — $18.10/hr, no minimum qualifications listed, evenings/nights available.
2. **No Frills Grocery Clerk (PT Day) / Dairy-Frozen Clerk / Meat-Deli-Bakery Clerk / Cashier, Bowmanville** — $17.95–$18.45/hr (Cashier scale $17.95–$27.44), explicitly no experience required, training provided. All four at Tim's No Frills, 95 Baseline Rd W. Note: the No Frills Cashier posting says the role handles liquor products — in Ontario that usually means 18+, check with the store.
3. **Home Depot Sales Associate (PT), Bowmanville** — $18.25–$19.25/hr, but lists a high-school diploma as minimum education — flag before applying.
4. **Subway Sandwich Artist, Bowmanville** — no experience, some high school; wage "to be discussed" (no figure in posting).
5. **Real Canadian Superstore Cashier (PT Day), Oshawa** — $17.95–$27.44/hr, no experience.
6. **Real Canadian Superstore Apparel Clerk (PT Day), Whitby** — $17.60–$18.45/hr, no experience.
7. **Giant Tiger Cashier (PT/Temporary), Oshawa** — $17.95/hr via Job Bank, but **advertised until 2026-11-19 and contract ends 2026-12-24** (holiday-season role).

Also verified Nov 17 but NOT after-school friendly: **Walmart Stocking 1 Team Associate, Bowmanville** — $18.10/hr, age 16+, but full-time. Better for summer or full-time work.

## What could NOT be verified

- **Walmart Cashier / Produce Stocker / General Merchandise Associate (Bowmanville):** roles confirmed live on the Walmart Bowmanville listing page, but their individual detail pages timed out when opened. Their $18.10 figure is the Bowmanville minimum shown on the verified Electronics Associate posting — not confirmed per-role.
- **Starbucks Barista, 96 King St E, Bowmanville:** posting text found only via aggregator mirrors; no wage shown anywhere. Listed as an ongoing hiring opportunity, no experience required.
- **Sherwin-Williams Store Associate, Bowmanville ($18.20):** the Bowmanville posting (Store #8104, 2377 Highway 2, Unit 218) was confirmed Nov 17 via Careerjet: **age 18+ and at least 1 year of experience in delivery, retail or customer service, plus previous paint-selling and tinting/mixing experience — not for Owen yet.** Wage from a SimplyHired snippet only.
- **Firehouse Subs Team Member, Bowmanville ($17.60)** and **Dollar Tree Customer Service Associate I, 2324 Hwy 2 ($ wage not shown):** snippet/mirror only.
- **Chartwell Server, Bowmanville Creek (105 Queen St):** snippet only, no wage shown. **Warning added Nov 17: recent Chartwell Server listings ask for a secondary school diploma or equivalent** — not a fit until Owen finishes school.
- **Dairy Queen Team Member, Courtice ($17.95, 1420 King St E):** snippet only; evenings/weekends mandatory.
- **COBS Bread Baker (PT), Courtice:** snippet only, no wage, and the posting dates from July 2026 — confirm still live; early-morning starts are a poor school-day fit.
- **Algoma Orchards Gourmet Market Associate, Newcastle ($17.95):** snippet only, and the posting explicitly says it is **NOT conducive to a student's schedule** — included as a warning, not a recommendation.
- **Browns Shoes, Winners, 7-Eleven (Oshawa); HomeSense, No Frills Student role (Whitby); Superstore Cashier, Best Buy (Ajax); Your Independent Grocer (Pickering):** all snippet/mirror only. The Pickering grocer role is a **night shift** — not recommended. The Whitby No Frills student role's range starts at $16.90, below the general minimum wage (likely the student/under-18 band) — verify the actual starting rate.
- **No Frills Produce Clerk, Bowmanville:** Workopolis lists it with the same $17.60–$18.45 range and "no experience needed", but the individual posting page was not opened, so it was **left out** of `jobs.json` rather than included unverified on a search-page URL. (The No Frills Cashier was added Nov 17 after its Simplify Jobs page was opened and read in full.)
- **McDonald's Bowmanville:** McDonald's careers pages found in search did not show a Bowmanville location in the text retrieved, so no McDonald's entry was included. (Wages seen for other Ontario McDonald's postings ranged $16.60–$18.25, student wage $16.90 — none tied to Bowmanville.)
- **No wage could be verified for:** Subway, Starbucks, Chartwell, Dollar Tree, COBS Bread Baker, Best Buy Ajax. Their `wage_cad_hourly` is `null`.

## Nov 17 changes — No Frills link trap

The old Loblaw careers links mix in postings from other provinces with different pay. Checked Nov 17:

- The Simplify Jobs **Grocery Clerk** listing with this title is a **BC posting** ($18.25–$18.45, tagged #BC) — it was NOT used. The Bowmanville Grocery Clerk card keeps the mywhitbyontario.ca mirror of the Tim's No Frills Bowmanville posting (posted Nov 12, 2026, $17.95–$18.45).
- **Meat/Deli/Bakery Clerk** and **Cashier** now link to the Loblaw listings on **Simplify Jobs** (both read in full Nov 17, Ontario, $17.95–$18.45 / Cashier $17.95–$27.44), not to Loblaw's careers site.
- **Dairy/Frozen Clerk** keeps its Indeed link (still live Nov 17, $17.95–$18.45).
- All four No Frills Bowmanville cards now carry the store address: **Tim's No Frills, 95 Baseline Rd W** (opened Oct 1, 2026, per Loblaw).

## Internships & student placements (`internships.json`, added Nov 17)

6 records, 3 verified. Same verification rule as jobs: `verified: true` only when the source page itself was opened and read in full.

- **Canada Summer Jobs — Municipality of Clarington summer-student roles: $20.96/hr, ages 15–30, Apr 26–Aug 27, 2027, applications close Sun Nov 22, 2026 at 11:59pm — URGENT.** Marked `verified: false` because the details were read from the Municipality's Indeed posting text and the posting page itself was not opened directly; the notes say so and point to clarington.net/careers. The deadline itself is confirmed in that posting text.
- **School co-op (KPR), Grades 11–12, unpaid, diploma credit, ~110 hrs/credit** — verified (kprschools.ca/co-op opened and read).
- **OYAP, age 15+, 14+ credits, Grades 11–12** — verified (KPR OYAP page opened and read).
- **St Marys Cement (VCNA) engineering co-op, Bowmanville, $25/hr** — verified (VCNA careers page opened; all three streams live at Bowmanville). Post-secondary only, plan-ahead; plant not reachable by public transit.
- **OPG Darlington summer co-op, $32.17–$43.68/hr** — plan-ahead, unverified; Summer 2026 postings closed Jan 2026.
- **Hydro One college co-op, Bowmanville, $1,976.48–$2,438.26 bi-weekly** — plan-ahead, unverified; Summer 2026 posting closed, Winter 2027 deadline was Oct 12, 2026.
- **No paid high-school internships exist in Bowmanville on the boards** as of Nov 17, 2026 — the section says so honestly instead of inventing one.

## Watch list (from the seed data — NOT current postings, NOT in jobs.json)

- **Clarington Library Student Page:** the only posting found was a PDF dated July 2025, deadline **July 28, 2025**, $17.20/hr, Newcastle/Orono/Bowmanville. **Expired.** The library's jobs page (cplma.ca) lists no current student opening; it does offer secondary-school **volunteer** roles and a Teen Advisory Group (TAG) that was full as of October 2026. Watch for a summer-2026-style repost. The library record in `initiatives.json` was marked `verified: false` on Nov 17, 2026 — the record is kept, not deleted.
- **Town of Clarington part-time recreation/aquatics:** no specific current vacancy was confirmed. Role types exist (Assistant Lifeguard/Assistant Instructor, min age 15, needs Standard First Aid + CPR-C and Bronze Cross/National Lifeguard; Lifeguard/Instructor min age 16, needs National Lifeguard + Instructor awards). These need certifications Owen may not have — check the Clarington careers page when a vacancy is posted.
- **TELUS:** verified as live — Part Time Sales Representative, Bowmanville Mall, total earnings $17.95–$43.24/hr (base + uncapped commission; the $17.95 floor is NOT a guaranteed base wage).
- **Chartwell:** Server posting found (snippet only, no wage) — see above.

## Search dead-ends

- **Job Bank (jobbank.gc.ca):** search-result pages are filter pages that do not expose individual student/part-time postings in text fetch; the RSS feed returned stale/irrelevant results. Only **one** Job Bank posting was verified directly: Giant Tiger Cashier, Oshawa (posting 50544137). No Bowmanville student posting was found on Job Bank itself.
- **Orono:** no part-time student-suitable postings found in any search. Nothing included.
- **Newcastle:** only Algoma Orchards (not student-friendly) and a full-time No Frills Produce Clerk (full-time, excluded). Nothing else verified.
- **A&W Crew Member (Overnight), Courtice:** found, but overnight shifts — excluded as not school-friendly.
- **No Tim Hortons entries anywhere**, per the standing rule.
- **Walmart detail pages:** two individual role pages timed out on fetch (Stocking 1 Team Associate, Cashier). Per the fetch-failure instruction these were not retried; the roles are included as unverified, sourced from the live Bowmanville listing page instead. (Stocking 1 was later verified Nov 17 via its Simplify Jobs mirror — $18.10/hr, age 16+, full-time.)
