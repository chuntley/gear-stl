# HTD 5M pulley STL generator

[Open the calculator](https://chuntley.github.io/gear-stl/). GitHub Pages serves
`index.html` from the root of `main`. The same file also works offline.

Double-click **`index.html`**. It is a self-contained offline
application; no installation, server, or internet is needed to generate STLs.
Email just **`index.html`** as an attachment. The recipient saves it
to their computer and opens it in a modern browser. All code, styling, and the
reference image are embedded; no other project files are needed. Online
reference links are optional.

1. Enter a target **outside diameter**, up to **12 in / 304.8 mm**.
2. Click a nearby row or its **Select** button. The tooth count is plain text;
   the highlighted row indicates the selected size.
3. Click **Download STL** below the dimensions. The STL is a **9 mm wide solid
   pulley blank**, with mounting features left for CAD.
4. Import the STL as **millimeters**, at **100% scale**. Do not resize it to
   force the exact target diameter; the selected tooth count determines its OD.

A 7 in target selects **112 teeth at 177.111 mm OD**. The next larger option is
**113 teeth at 178.702 mm OD**. The largest available option is **192 teeth at
304.434 mm OD**. Nearby options never exceed the 12 in limit.

The exported grooves include **0.10 mm local print-fit relief**, selected using
explicit print-error sensitivity tests. Pitch, tooth count, angular spacing,
outside diameter, and 9 mm width stay fixed. The print-adjusted profile is not
an ISO-certified part. Test the actual belt before committing to the final part.

`examples/` includes updated 112/113-tooth solid blanks and open-center test
rings, all 9 mm wide. Test rings have 3 mm of radial material below the groove
roots. They allow a full-diameter fit test without printing a solid disk. No
mounting-hole, width, or existing-print diagnostic controls are exposed in the UI.

## Printing

Start with the appropriate material profile, a 0.4 mm nozzle, and 0.16–0.20 mm
layers. Print flat with the shaft axis vertical, calibrate flow, inspect the
sliced teeth, and avoid high outer-wall speeds for the fit test. Keep the
teeth filled with walls. These are starting recommendations, not a load rating.

First-layer bulging can prevent seating even when pitch is correct. Use measured
first-layer compensation, avoid brim residue in grooves, and remove seam blobs
from groove flanks. Measure tooth-tip diameter in multiple directions. Use the
same filament and settings for the test ring and final pulley.

PLA is useful for the first fit test. PETG offers more temperature margin, but
filament grade, creep, wear, operating temperature, load, mounting, belt length,
alignment, tension, and tracking still need validation. Hubs, fastening features,
and flanges are deliberately left for CAD.

## Validation and limitations

[Validation report](validation/README.md) includes:

- Serialized mesh checks over 12–200 teeth, for both solid and ring meshes.
- Independent STL loading, cross-sections, and pitch-registration checks.
- 2D contact sensitivity with a nominal 5M tooth proxy under explicitly assumed
  scale, ovality, surface-growth, and first-layer errors.

The contact study uses published nominal HTD 5M dimensions, not a scan or
manufacturer tolerance model of the user's VEX belt. It is not a rubber/contact
force simulation. It cannot prove physical fit, strength, durability, or printer
accuracy; the full-diameter test ring remains the final fit check.

## Development

Edit `pulley-calculator.template.html`, `pulley-math.js`, or `pulley-mesh.js`, then:

```sh
node build.js
node --test pulley-math.test.js pulley-mesh.test.js
```

Node is required only for development. The generated HTML embeds these sources,
Earcut 2.2.4 and its ISC license, and the manufacturer reference image. Geometry
sources and assumptions are documented in [references](references/README.md).

The optional Python validation scripts require numpy, trimesh, shapely, and
matplotlib. They are not dependencies of the application.
