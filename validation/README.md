# Geometry and print-fit validation

The application exports a print-adjusted HTD 5M profile with **0.10 mm local
groove relief**. Outside diameter, 5 mm pitch, tooth count, indexing, and 9 mm
axial width are unchanged. This allowance was selected from the sensitivity
study below; it is not a claim of ISO certification or measured printer accuracy.

## Results

- **17 Node tests**, including serialized geometry checks for **378 meshes**:
  solid and test-ring versions of every count from 12 through 200. Checks cover
  paired/oppositely oriented edges, valid normals, nondegenerate triangles,
  positive volume, dimensions, target limits, and print-relief invariants.
- The application exposes only counts **12–192**, so all nearby options stay
  within the **12 in / 304.8 mm** target cap. The kernel's additional counts are
  exercised as geometry boundary tests, not offered above the application cap.
- Independently loaded 112/113-tooth STLs are watertight, connected positive-
  volume bodies with 9 mm width and valid, non-self-intersecting cross-sections.
  Their recovered groove spacing shows no significant indexing drift; the
  numerical error in the pitch study is below 0.001 mm.
- **120 contact-sensitivity cases / 67,520 tooth placements** compare four
  relief amounts, three tooth counts (112, 113, 192), and ten print-error cases.
- Standalone browser checks cover an isolated copy of the HTML in offline mode,
  row/Select selection, constant Select text, selected-size STL download, 9 mm
  output, both unit caps, invalid-state clearing, embedded reference image,
  mobile layout, and absence of printer-brand text on the site.

See [indexing results](geometry-results.json), [print-fit results](print-fit-results.json),
[indexing plot](pitch-registration.svg), and [print-error comparison](print-error-sensitivity.svg).

## Assumed print-error envelope

These are explicit sensitivity inputs, **not** measured errors or advertised
accuracy of any printer. They are the same assumptions for PLA and PETG; no
material-specific shrinkage or strength has been inferred without measurement.

| Assumption | Applied error |
| --- | --- |
| Uniform XY diameter error | +0.10 mm and -0.10 mm |
| Ovality | X diameter +0.10 mm, Y diameter -0.10 mm |
| Surface overgrowth | 0.05 mm normal material growth |
| Combined calibrated-size case | +0.10 mm OD and 0.05 mm surface growth |
| Combined case at first layers | Above, plus 0.03 mm residual first-layer bulge |
| First-layer sensitivity | 0.20 mm uncompensated bulge over bottom 0.4 mm |
| Residual first-layer sensitivity | 0.03 mm bulge over bottom 0.4 mm |
| Severe-error positive control | +0.20 mm OD and 0.10 mm surface growth |

A diameter error is not a radial error. The model transforms the actual outline
and offsets its surfaces, then constructs the belt pitch line as an offset from
the resulting nominal tooth-tip ellipse. Anisotropic XY error changes local
pitch spacing around the ellipse. The belt advances in fixed 5 mm increments
along this pitch line. Eight anchor positions check axes/diagonals and all teeth
in approximately 180 degrees of wrap, centered on an aligned groove.

The first-layer case tests the expanded bottom slice while retaining the main-
body belt seating position. It does not hide a bottom-edge collision by lifting
the entire belt to match the bulged first layer.

## What changed and why

The unrelieved nominal profile produces a small rigid overlap with the nominal
tooth proxy, principally because the proxy is 2.08 mm deep and the 81–200 groove
band is 2.056 mm deep. This alone does not establish a defect in a commercial
pulley: real belt teeth deform, and standard profile bands have tolerances.

A 0.05 mm local allowance still produces small overlap in the combined assumed
error cases. A **0.10 mm allowance** clears the nominal and calibrated-error
cases at all three tested counts within a 0.00001 mm² numerical overlap threshold.
This is why the exported profile now uses 0.10 mm instead of the unrelieved
nominal shape. Increasing allowance to 0.15 mm was also tested; the smaller
passing amount was retained to limit unnecessary backlash/material removal.

The **0.20 mm uncompensated first-layer bulge still fails** with the chosen
allowance, as does the severe-error control. For the 113-tooth case the bulged
slice needs about 0.123 mm of rigid proxy lift to clear. Fix first-layer and
extrusion errors in the slicer/process rather than opening every groove enough
to hide them or scaling the pulley. The lift result is geometric displacement,
not a predicted physical deformation, belt tension, or force. The lift search
is capped at 0.80 mm; results flagged `lift_search_limited` are lower bounds.

## Belt model and limits

The identified belt is **VEX HTD 5 mm pitch, 9 mm width**. No detailed VEX
production profile, measured tooth tolerances, rubber properties, or belt scan
was available. The contact study therefore uses a **nominal H5M tooth proxy**
from ISO 13050:2022 Table 9: its rounded point coordinates and circular radii
are connected and bent around the modeled pitch line. This approximates the
identified belt family; it is not evidence of the exact VEX tooth surface.

The 2D overlap test ignores friction, elasticity, cord tension, tooth compression,
load transfer, entry/exit dynamics, belt wear, creep, and thermal deformation.
It does not certify a working drive or predict lifetime, allowable torque, or
skipping under load. No PLA/PETG mechanical strength claim follows from these
geometric results. The belt's actual loop length, companion pulley, mounting,
alignment, tension, and tracking must be checked separately.

A **full-diameter test ring with the actual belt and final print settings** is
still necessary. A short arc or a few aligned teeth cannot detect accumulated
spacing error around the intended wrap. Example rings are in `examples/`;
production downloads in the simplified UI remain solid blanks.

## Practical printing considerations

- Print flat with the shaft axis vertical. This forms the tooth profile in XY
  and avoids support material on working groove surfaces.
- Use a 0.4 mm nozzle with 0.16–0.20 mm layers as a starting point, moderate
  outer-wall speed, calibrated flow, and enough perimeters to fill the teeth.
  Inspect thin lands in the slicer, particularly at the smallest tooth counts;
  some are narrow enough to need variable-width walls or a smaller nozzle.
- Inspect and compensate first-layer bulging. Do not let brim residue, stringing,
  or seam blobs occupy groove flanks. Remove them without widening the whole
  tooth pattern. Keep the STL at 100% scale.
- Use the same material and settings for the fit ring and final part. Dry PETG
  according to its filament instructions. PLA is useful for a first fit test;
  PETG has more temperature margin, but neither is automatically load-rated.
- The 192-tooth option has 304.434 mm OD. On a 340 × 320 mm printable area, a
  centered 5 mm brim gives a 314.434 mm footprint and only about 2.8 mm spare on
  each side of the narrower dimension. Verify the slicer's actual keep-outs,
  purge structures, and printable area instead of relying only on nominal bed
  dimensions. A brim is not automatically necessary.
- Adding a hub, fastening pattern, flanges, and sufficient support in CAD is
  essential before use as a drive. Width matching alone does not provide belt
  tracking, load capacity, or secure shaft attachment.

Sources: [ISO 13050:2022](https://www.iso.org/standard/82453.html),
[manufacturer belt-family reference](https://wcproducts.info/files/frc/drawings/Web-HTD%20Belt%209mm%20Width.PDF),
[first-layer compensation explanation](https://help.prusa3d.com/en/article/elephant-foot-compensation_114487),
[filament manufacturer comparison guide](https://cdn1.bambulab.com/filament/filament-guide/wksdyyzd8n9/filament-guide-en.pdf).
Printer-brand references remain outside the site's text.

## Reproduce

The HTML application has no runtime dependencies. The optional development
checks use:

```sh
node build.js
node --test pulley-math.test.js pulley-mesh.test.js pulley-step.test.js
python -m pip install numpy trimesh shapely matplotlib
python validation/check_geometry.py
python validation/check_print_fit.py
```

Scripts write JSON and plots beside themselves. Review their assumptions before
changing thresholds; a pass only applies to the modeled error envelope.

## STEP export checks

The STEP AP214 exporter uses the exact analytic profile shared with STL sampling.
Node tests check closed/tangent curve joins across every count from 12–200, arc
radii, agreement with the STL outline within its chordal bound, paired boundary
edges, entity references, units, and button order. STEP uses planar and cylindrical
surfaces; there are no triangulated, faceted, or fitted-spline substitutes.

`check_step.py` independently reads actual exports with Open Cascade at 12, 16,
17, 25, 26, 80, 81, 112, 113, 192, and 200 teeth. It checks one valid solid,
9 mm width, analytic surface counts, bounds, and positive volume. At 112 and
192 teeth it also cuts a 6 mm central mounting hole and verifies the resulting
solid and removed volume. This hole exists only in the validation operation;
production downloads remain solid blanks. See [results](step-results.json).
SOLIDWORKS itself was unavailable; these checks do not claim a SOLIDWORKS-specific
import certification or change the physical-fit limitations above.

Optional development checks:

```sh
python -m pip install cadquery-ocp
python validation/check_step.py
# With Playwright installed and Google Chrome available:
node validation/check_browser.cjs
```

If Playwright is installed outside the usual Node module search path, set
`PLAYWRIGHT_MODULE` to its module directory. Browser checks copy only `index.html`
to a temporary directory, disable network access, test both STEP/STL downloads,
selection, invalid-state disabling, cap handling, and mobile layout, then remove
the temporary directory. End users need none of these development tools.
