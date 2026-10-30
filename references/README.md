# HTD 5M source references

Retrieved 2026-10-26. Manufacturer documents are retained as references with
original attribution. They are not project-authored CAD or a certification of
printed belt fit.

## Included manufacturer pulley groove drawing

`misumi-htd5m-profile.jpg` is the unmodified “Standard Tooth Profile” image from
[MISUMI's HTD 5M timing pulley product page](https://th.misumi-ec.com/en/vona2/detail/110310532889/).
[Original image](https://th.misumi-ec.com/en/linked/item/10310532889/img/a210005.jpg).

The manufacturer identifies this as a 5.0 mm pitch pulley profile and notes that
groove size varies slightly with tooth count. The drawing shows 2.16 mm groove
depth, R1.56 and R0.5 radii, approximately 14° flanks, and a rounded 0.572 mm
radial pitch-line differential. It illustrates the curved groove and transitions
missing from the old circular-groove sketch. Do not substitute the belt tooth
profile for this pulley groove profile.

This drawing does not specify every construction constraint or a tooth-count
specific profile for a 112- or 113-tooth pulley. It is included as a verified
manufacturer reference, not traced into an allegedly exact fabrication outline.

## Included catalog excerpt and nominal sizing

`misumi-htd5m-excerpt.pdf` contains three unchanged pages extracted from
[MISUMI's timing pulleys, idlers, and timing belts catalog](https://my.misumi-ec.com/pdf/my/economy_catalog/misumi_economy_timing_pulleys_idlers_timing_belts.pdf):

- Excerpt pages 1–2: original PDF pages 17–18, printed pages 541–542, HTD 5M
  pulley dimensions. The 20-tooth example lists pitch diameter 31.83 mm and
  outside diameter 30.69 mm.
- Excerpt page 3: original PDF page 65, printed page 589, HTD 5M belt data with
  5 mm pitch and PLD 0.5715 mm. This is a belt drawing, not the pulley groove.

The calculator uses `PD = N * 5 / pi` and `OD = PD - 2 * 0.5715` in mm.
The old 1.14 mm diameter offset was rounded; 1.143 mm retains the published PLD
precision. The 0.003 mm difference does not explain the reported print mismatch.
Display values are rounded; selection calculations use full precision.

## Manufacturer CAD catalog

[Gates HTD 5M CAD on TraceParts](https://www.traceparts.com/en/product/gates-pulley-htd-5m?Product=32-30092010-109669)
identifies Gates as manufacturer and offers models for listed stock sizes.
Downloads may require browser verification and registration. No manufacturer STEP or DXF is bundled here. Project-generated 112- and
113-tooth print-adjusted STL examples are included separately in `examples/`. Do not scale a different tooth-count model
as a substitute for a correct 113-tooth design.

[SIT's HTD manufacturer page](https://sitspa.com/timing-belt-drives/timing-belt-drives-top-drive-htd/)
also links its [pulley CAD catalog](https://www.traceparts.com/els/sit/goto?CatalogPath=SIT%3ASIT.1.1.3)
and [pulley dimensional catalog](https://sitspa.com/wp-content/uploads/_documents/en/HTD-Timing-pulleys.pdf).

## Implemented count-dependent STL profile

The generator now uses the H5M groove parameter bands in
[ISO 13050:2022](https://www.iso.org/standard/82453.html), Table 14, together with
[Figure 11 on ISO’s Online Browsing Platform](https://www.iso.org/obp/graphics/std/iso_std_iso_13050_ed-3_v1_en/fig_11.png).
The table is also visible in the
[standards catalog preview](https://standards.iteh.ai/catalog/standards/iso/1ab35798-3583-4e07-b16b-3b18be61a4fe/iso-13050-2022).
The generator is original project code; the standard itself is not bundled.

The four supported tooth-count bands are 12–16, 17–25, 26–80, and 81–200.
For example, the last band supplies 2.056 mm groove depth, 0.028 mm bottom
half-width/arc-center offset, 1.552 mm root radius, 5 degree flank angle, and
0.569 mm tip radius. Other bands are implemented in `pulley-mesh.js`.

Construction in local tangential/radial coordinates:

1. Place the groove bottom at `OD/2 - depth`, with a flat bottom from `-X` to
   `+X`. The right root-circle center is `(X, OD/2 - depth + rootRadius)`.
2. Follow the root arc to its tangent at the specified flank angle. Extend the
   straight flank to a tip-radius fillet whose center lies on the circle of
   radius `OD/2 - tipRadius`. Solve the line/circle intersection analytically.
3. The fillet is tangent to the flank and actual OD circle. Mirror the groove,
   connect neighboring grooves by OD-circle lands, and repeat by `360/N`.
4. Sample curved segments with maximum chordal deviation 0.002 mm. Use float32
   coordinates before triangulation so STL rounding does not invert skinny cap
   facets. Exact tangencies are properties of the underlying construction;
   exported STL is a faceted approximation.
5. Triangulate the end faces with bundled Earcut 2.2.4 and join both faces with
   outward-wound sidewalls. Test-ring centers are circular holes in the same
   mesh, not overlapping disconnected solids. Production blanks have no bore.

Sizing retains the more precise MISUMI PLD 0.5715 mm; the ISO table rounds this
to 0.572 mm. Their resulting nominal ODs differ by 0.001 mm.

The printed profile now applies **0.10 mm local groove relief**, selected from
the documented sensitivity study in `validation/`. Groove depth and root radius
increase by this amount, while tip blend radius decreases by the same amount;
the blend is solved again against the unchanged OD circle. This is a deliberate
print allowance outside the nominal profile, not ISO certification. It does not
change tooth count, pitch, OD lands, or axial width. No global scale compensation
is applied. The general MISUMI illustration remains a nominal reference.

The general MISUMI groove illustration and the count-specific ISO parameters
are distinct references. The exporter uses the latter, rather than tracing the
former or asserting that the two profiles are dimensionally identical.

Earcut 2.2.4 is vendored from its published
[npm distribution](https://unpkg.com/earcut@2.2.4/dist/earcut.min.js).
Its [upstream license](https://github.com/mapbox/earcut/blob/v2.2.4/LICENSE) is
preserved in `vendor/earcut-LICENSE` and embedded in the standalone HTML.

## Physical fit

Nominal geometry does not validate a printed groove or certify conformance of
the finished part. Verify print scale and roundness, actual belt width, and full
belt seating using the test ring. No fit test with the user's physical belt or
printer has been performed. The mesh and its topology have been checked in
software, which cannot substitute for this fit check.

OD-based drift estimates assume nominal pitch-line offset and full seating;
they are diagnostic estimates, not measured belt pitch or automatic printer
compensation. Do not resize a generated pulley to hit an arbitrary target OD.

## Printing assumptions and sources

The print-error study uses ISO 13050:2022 Table 9 nominal H5M tooth points and
radii to build a bent tooth proxy. No detailed VEX production tooth profile,
material test data, or belt tolerance measurements were available. A different
supplier's [9 mm HTD belt drawing](https://wcproducts.info/files/frc/drawings/Web-HTD%20Belt%209mm%20Width.PDF)
confirms the 5 mm pitch / 9 mm width family but is not evidence that its belt has
identical VEX production tolerances.

First-layer bulging and the purpose of its compensation are documented by
[Prusa's printing knowledge base](https://help.prusa3d.com/en/article/elephant-foot-compensation_114487).
Compensation should be based on a measured print, not adopted as a universal
number. The site remains printer-neutral.
