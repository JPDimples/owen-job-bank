# Job sites — verification notes (2026-11-16)

Every candidate was fetched and its content checked for real Bowmanville job
results. A plain HTTP 200 from curl was NOT treated as proof: the Walmart
careers deep link returned 200 to curl but showed Walmart's error page in a
real browser, so each site below was judged on what its page actually shows.

## Included (verified)

- **Indeed Canada** — `https://ca.indeed.com/jobs?l=Bowmanville%2C+ON`
  Fetched page titled "$37K–$130K Jobs in Bowmanville, ON" with a real
  Bowmanville posting (Machine Operator, $21.00–$26.00/hr, in person).
  Template also tested for Oshawa: "$33K–$142K Jobs in Oshawa, ON" with a
  real City of Oshawa posting. Template: `?l={town}%2C+ON`.
- **LinkedIn Jobs** — `https://www.linkedin.com/jobs/search/?keywords=&location=Bowmanville%2C%20Ontario%2C%20Canada`
  Fetched page titled "Jobs in Bowmanville (2,000+ Open Roles)" with real
  listings. Template also tested for Oshawa: "5,000+ Jobs in Oshawa" with
  real listings. Results cover a ~25-mile radius around the town, so nearby
  towns appear too. Browsing the results works without signing in; applying
  needs a free account.

## Dropped (not verified)

- **Government of Canada Job Bank** — the `locationstring` parameter is
  ignored in the fetched page: both `Bowmanville, Ontario` and
  `Bowmanville, ON` returned the generic "All of Canada" search (68,102
  results, 0 Bowmanville mentions). Job Bank's location search needs its
  autocomplete to resolve a location code, so no plain URL template can be
  verified to return Bowmanville results. Dropped, not broken — the link
  just cannot be pre-set to Bowmanville.
- **Glassdoor** — the constructed URL
  (`/Job/bowmanville-jobs-SRCH_IL.0,11_IC2281108.htm`) resolved to the wrong
  place: the fetched page was titled "1 Huangchang, Hunan job" (China).
  The location ID does not correspond to Bowmanville, and no correct
  Bowmanville search URL could be verified. Dropped.
- **ZipRecruiter** — the empty `search=` parameter was treated as the
  keyword "search", so the fetched page returned SEO/search-engine jobs
  across the US, not Bowmanville jobs; the location did not take effect.
  No working Bowmanville URL pattern could be verified. Dropped.
- **Monster** — 403 access denied to both curl and the page fetcher.
  Content could not be confirmed. Dropped.
- **Jobillico** — the page loaded but showed an unrendered template with
  `{{ }}` placeholders and no Bowmanville jobs; the location parameter had
  no effect. Dropped.
- **Eluta** — bot-verification challenge page ("are you a human?") to both
  curl and the page fetcher; also unreachable (connection failed) from curl.
  Content could not be confirmed. Dropped.

All eight candidates were checked on 2026-11-16. The two included sites are
the only ones whose Bowmanville search could be confirmed as real results.
