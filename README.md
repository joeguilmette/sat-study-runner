# SAT Study Runner

Small static SAT Reading and Writing practice app built for GitHub Pages.

## Contents

- `index.html`: app entry point
- `app.js`: quiz logic
- `styles.css`: app styles
- `sat-results.enriched.json`: question bank and study-category metadata
- `sat-results.html`: enriched source table
- `sat-study-analysis.json`: category analysis data
- `sat-study-priorities.md`: study-priority summary

## Local use

Serve the folder over HTTP, then open the local URL:

```bash
python3 -m http.server 8000
```

## Question bank format

The app reads `sat-results.enriched.json` directly. New questions can be added later as long as they follow the same structure used by the existing `questions` array.
