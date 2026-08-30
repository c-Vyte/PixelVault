# Admin Panel Display Font

The admin panel uses the `--font-admin` stack defined in `src/app/globals.css`:

```
"Bavaria Gates" → "Gimolla" → "Circus Ace" → Cinzel (bundled fallback)
```

`Bavaria Gates`, `Gimolla`, and `Circus Ace` are **licensed commercial fonts**, so
they are not shipped with this project. Until one is supplied, the admin renders
with **Cinzel** — a free Google font chosen because it closely matches the
all-uppercase modern-serif character of Bavaria Gates.

## Use the real font

Drop the font file into this folder using one of these exact names:

| Font          | File name                                     |
| ------------- | --------------------------------------------- |
| Bavaria Gates | `BavariaGates.woff2` or `BavariaGates.otf`    |
| Gimolla       | `Gimolla.woff2` or `Gimolla.otf`              |
| Circus Ace    | `CircusAce.woff2` or `CircusAce.otf`          |

No code change is required — the `@font-face` rules already point at these paths,
and the font is also picked up automatically if it is installed locally on the
machine viewing the site.

## Switch which font leads

Edit the `--font-admin` variable in `src/app/globals.css` and move the desired
family to the front of the list. For example, to lead with Circus Ace:

```css
--font-admin: "Circus Ace", "Bavaria Gates", "Gimolla",
  var(--font-admin-fallback, 'Cinzel'), Georgia, serif;
```

## Where it applies

The font is scoped to `.admin-scope` (the admin sidebar + content area), so it
styles admin headings, page titles, and menu labels only. The public site keeps
its own Space Grotesk / JetBrains Mono / Inter typography.
