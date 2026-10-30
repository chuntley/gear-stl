# Purpose and current user requirements

This project generates printable HTD 5M pulley blanks for a VEX 5 mm pitch,
9 mm wide timing belt. It is a single self-contained offline HTML application.

Preserve these explicit user choices:

- Target outside diameter is the only sizing input, with inches/mm units.
- Maximum target is 12 in / 304.8 mm; nearby options must also stay below it.
  Maximum available tooth count is 192 (OD 304.434 mm).
- A table row and its Select button both select that size. The tooth count is
  plain text, and every button always reads Select, never Selected. Use row
  highlighting and `aria-pressed` to convey selection.
- Download STL appears below the selected dimensions and their belt-pitch note.
- No mounting-hole option, STL-export section, existing-print-check section,
  min/max diameter controls, tooth-count override, or delta column.
- Output is a 9 mm axial-width solid blank. Mounting features are added in CAD.
- Keep the site printer-neutral: do not mention the user's printer brand there.
- User authorized fit/error simulations and changes justified by them. Actual
  printer accuracy and belt production tolerances have not been measured.

The user uses a standard H2S with PLA or PETG, which informs internal testing
and print advice. Do not turn assumed errors into manufacturer accuracy claims.

## Files and running

- `index.html`: generated distribution; runs offline by itself.
- `pulley-calculator.template.html`: editable UI source.
- `pulley-math.js`: nominal sizing and nearby options. Historical OD diagnostic
  math is retained for regression tests, with no corresponding UI.
- `pulley-mesh.js`: ISO-derived groove construction, local print-fit relief,
  extrusion, internal test-ring support, and binary STL serialization.
- `vendor/earcut.min.js` and `vendor/earcut-LICENSE`: Earcut 2.2.4 under ISC.
- `build.js`: dependency-free Node builder embedding scripts, license, and image.
- `pulley-math.test.js`, `pulley-mesh.test.js`: Node regression suites.
- `examples/`: regenerated 112/113-tooth solids and test rings, 9 mm wide.
- `validation/`: independent geometry/contact sensitivity scripts, result JSON,
  plots, and limitations. Python tools are development-only dependencies.
- `references/`: source notes, manufacturer image, and catalog excerpt.
- `htd5m_pulley_drawing.svg`: legacy fixed nominal dimension reference.

After source edits, run `node build.js`. Never edit generated HTML directly.
End users need no Node, Python, Go, installation, server, or internet. Preserve
vendored license attribution. Reference catalog links require internet but are
not runtime dependencies.

## Sizing and geometry

All math uses mm: pitch P=5, radial pitch-line differential PLD=0.5715, sourced
from MISUMI. PD=N*5/pi; OD=PD-1.143; angle=360/N; pitch circumference=N*5.
The pitch circle follows the belt pitch line above the tooth tips; it is not a
circle through groove centers. Never scale a stock tooth count to a target OD.

`options(target)` selects the nearest integer and shows nearby valid options.
It rejects values above 304.8 mm and clips options to <=192 teeth. Switching
units converts the target and updates input bounds; use exact HTML max values
12 and 304.8 rather than the floating-point quotient 304.8/25.4. Changing target
resets selection. Invalid input clears stale results and disables downloads. Boundary comparisons
allow only floating-point roundoff from unit conversion (about 2e-12 mm).

The mesh kernel covers published H5M bands 12–16, 17–25, 26–80, 81–200 from
ISO 13050:2022 Table 14 / Figure 11. The application target cap exposes only
12–192. `profile(n)` returns nominal parameters; `outline(n, relief)` constructs
the print-adjusted shape. The default PRINT_RELIEF is 0.10 mm; zero is used by
the validation study for a nominal comparison.

Construction starts with flat groove bottom -X..+X, tangent root arcs, straight
flanks, and OD-tangent tip fillets. For print relief, increase groove depth and
root radius by 0.10 mm, decrease tip blend radius by 0.10 mm, and solve tangency
to the unchanged OD circle. This removes material locally from grooves while
keeping OD lands, pitch, and angular indexing fixed. It is a manufacturing
allowance, not a claim that the adjusted profile is ISO certified. Source details
and the distinction from the general MISUMI illustration are in references.

Sample arcs to <=0.002 mm chordal deviation before float32 coordinate rounding.
Quantize XY coordinates before triangulating caps, to avoid rounding-induced
inversion of skinny triangles. Earcut handles nonconvex outlines; do not assume
a star-shaped contour. Cap and sidewall winding must produce a closed solid.

`mesh(n, width, testRing=false)` uses 9 mm in the application. Internal width
validation allows 1–100 mm for tests. A test ring has an open center and 3 mm
radial material below roots. There is no mounting-bore API or UI. Hubs, flanges,
fastening, drive layout, and load ratings are outside this generator.

## Physical regression and accuracy assumptions

The user reported 113 teeth forced to 7 in OD, losing alignment after about
18 teeth. Nominal 112T OD=177.110536 mm; 113T OD=178.702086 mm. A 113T part at
177.8 mm gives estimated drift -0.451 mm over 18 spaces, assuming nominal PLD.
That is smaller than a half pitch (2.5 mm), so this alone cannot explain the
entire observed mismatch. Eighteen tooth centers span seventeen spaces.

Do not claim physical VEX fit from watertightness or indexing alone. The print
study uses a nominal H5M proxy from Table 9, bent around a pitch line, not an
actual scanned VEX tooth. It tests ~180-degree wrap and assumptions including
+/-0.10 mm OD, ovality, 0.05 mm surface growth, and 0.03 mm residual first-layer
bulge. The 0.10 mm groove allowance passed these modeled cases within the study's
small overlap tolerance. An uncompensated 0.20 mm first-layer bulge and severe
combined size/surface errors still fail. Correct slicer/flow errors instead of
increasing relief indefinitely or scaling the STL. There is no rubber elasticity,
friction, tension, wear, creep, strength, or dynamic-load model.

## Verification

Run `node --test pulley-math.test.js pulley-mesh.test.js` after changes. It
checks dimensions, target cap, row data, invalid input, band boundaries, geometry
for all 12–200 counts, relief invariants, and every solid/ring serialized STL
(378 meshes) for manifold edge pairing, normals, positive volume, and width.
The full mesh sweep can take noticeably longer than the math tests.

Browser checks must copy only the HTML elsewhere and run offline. Check clicking
rows/Select, constant Select text, static tooth-count cells, selected download
filename/geometry, 9 mm width, both unit caps, invalid-state clearing, embedded
image, mobile layout, and absence of printer-brand text. Playwright/Chrome was
used through a temporary harness, not an application dependency.

`validation/check_geometry.py` independently loads STLs with trimesh and recovers
midplane contours, checks connection/validity, and measures groove indexing.
`validation/check_print_fit.py` compares nominal and relieved profiles under
stated print-error scenarios. Read validation/README.md before interpreting
results; no physical fit test has been performed. Regenerate examples after
geometry changes so they match the application.
