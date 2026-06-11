# Litter Invalidator Purity (LI Purity)

A userscript that cleans up your professional network feed. Inspired by
[F.B. Purity](https://www.fbpurity.com/), which has been doing the same for
another social network for over a decade.

Sponsored posts, suggested content, people recommendations, course plugs and
job teasers are injected between the posts you actually follow. LI Purity
hides each of them behind its own toggle, so you decide what your feed shows.

## Features

A small control panel (bottom-left of the feed) with independent switches:

| Toggle | What it hides |
| --- | --- |
| Promoted | Sponsored posts |
| Suggested | Algorithmic "Suggested" posts from accounts you do not follow |
| People you may know | Connection-suggestion carousels in the feed |
| Recommended for you | Follow-suggestion modules in the feed |
| Popular course (Learning) | Course-promotion modules |
| Top applicant jobs | Job-teaser modules |
| "Follows this Page" | Posts shown only because a connection follows the Page |
| Right column | The whole right rail (puzzles, follow suggestions, the ad box) |
| Stretch feed into freed space | Optional: widen the feed into the hidden right column's space |

Per-view counters show how many items each filter hid. Settings persist in
your browser (`localStorage`), and every toggle takes effect immediately, in
both directions.

## Install

1. Install a userscript manager:
   [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Edge, Firefox,
   Safari, Opera) or [Userscripts](https://github.com/quoid/userscripts)
   (Safari).
2. Install the script:
   - from the Greasy Fork listing (recommended; updates flow automatically), or
   - directly from this repo:
     [`lipurity.user.js`](https://raw.githubusercontent.com/RoFz/lipurity/main/lipurity.user.js)
     (auto-updates via the script's `@updateURL`).
3. Open your feed. The LI Purity panel appears bottom-left.

## How it works

- Posts are matched by stable accessibility semantics (ARIA roles) plus the
  exact on-screen label text, never by the site's hashed CSS class names,
  which change between builds.
- A debounced `MutationObserver` keeps up with infinite scroll.
- The panel is built with plain DOM calls, so it works under the site's
  Trusted Types CSP.
- No network requests, no analytics, no data collection of any kind. The only
  thing the script stores is your toggle settings, in your own browser.

## Limitations

- Label detection is English-only out of the box. Other languages work by
  adding the exact rendered strings to the `LABELS` map; see
  [CONTRIBUTING.md](CONTRIBUTING.md) for how to request your locale.
- The site ships different layout builds to different users (A/B testing).
  The selectors target the common build; if a filter stops matching after a
  site update, please open an issue.
- Two filters ("Popular course", "Top applicant jobs") were implemented from
  the documented module pattern and user reports; if one leaks through,
  an issue with a screenshot helps fix it quickly.

## Privacy

The script runs entirely in your browser. It does not collect, transmit, or
store any data anywhere except your own browser's `localStorage` (toggle
preferences only).

## Contributing

External pull requests are not accepted; see
[CONTRIBUTING.md](CONTRIBUTING.md). Bug reports, filter requests, and label
translations via issues are very welcome. Security reports go through
[private vulnerability reporting](SECURITY.md).

## Disclaimer

This is an independent, unaffiliated project. It is not associated with,
endorsed by, or sponsored by any social network platform or its operators.
All product names referenced in functional code (site addresses, on-screen
text matched by filters) are used solely to make the script work and remain
the property of their respective owners. Use at your own risk: client-side
feed filtering may conflict with a platform's terms of service, and you are
responsible for your own account.

## License

[MIT](LICENSE)
