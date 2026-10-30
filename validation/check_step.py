"""Read real STEP exports with Open Cascade, independently of the JS exporter.
Development only: python -m pip install cadquery-ocp
No CAD kernel is needed by the standalone HTML application.
"""
from pathlib import Path
import json
import math
import subprocess
import tempfile

from OCP.BRepAdaptor import BRepAdaptor_Surface
from OCP.BRepAlgoAPI import BRepAlgoAPI_Cut
from OCP.BRepBndLib import BRepBndLib
from OCP.BRepCheck import BRepCheck_Analyzer
from OCP.BRepGProp import BRepGProp
from OCP.BRepPrimAPI import BRepPrimAPI_MakeCylinder
from OCP.Bnd import Bnd_Box
from OCP.GProp import GProp_GProps
from OCP.GeomAbs import GeomAbs_Cylinder, GeomAbs_Plane
from OCP.IFSelect import IFSelect_RetDone
from OCP.STEPControl import STEPControl_Reader
from OCP.TopAbs import TopAbs_SOLID, TopAbs_FACE
from OCP.TopExp import TopExp_Explorer
from OCP.TopoDS import TopoDS

ROOT = Path(__file__).resolve().parent.parent
COUNTS = [12, 16, 17, 25, 26, 80, 81, 112, 113, 192, 200]


def count(shape, kind):
    explorer = TopExp_Explorer(shape, kind)
    total = 0
    while explorer.More():
        total += 1
        explorer.Next()
    return total


def volume(shape):
    props = GProp_GProps()
    BRepGProp.VolumeProperties_s(shape, props)
    return props.Mass()


def check_file(path, n):
    reader = STEPControl_Reader()
    assert reader.ReadFile(str(path)) == IFSelect_RetDone
    assert reader.TransferRoots() == 1
    shape = reader.OneShape()
    assert BRepCheck_Analyzer(shape).IsValid(), f'{n}T invalid topology'
    assert count(shape, TopAbs_SOLID) == 1
    assert count(shape, TopAbs_FACE) == 8 * n + 2
    bounds = Bnd_Box()
    BRepBndLib.AddOptimal_s(shape, bounds, False, False)
    xmin, ymin, zmin = bounds.CornerMin().Coord()
    xmax, ymax, zmax = bounds.CornerMax().Coord()
    assert abs(zmin) < 1e-7 and abs(zmax - 9) < 1e-7
    radius = (n * 5 / math.pi - 1.143) / 2
    assert max(abs(xmin), abs(xmax), abs(ymin), abs(ymax)) <= radius + 1e-7
    cylinders = planes = 0
    explorer = TopExp_Explorer(shape, TopAbs_FACE)
    while explorer.More():
        surface = BRepAdaptor_Surface((getattr(TopoDS, 'Face_s', None) or TopoDS.Face)(explorer.Current()))
        if surface.GetType() == GeomAbs_Cylinder:
            cylinders += 1
        else:
            assert surface.GetType() == GeomAbs_Plane
            planes += 1
        explorer.Next()
    assert cylinders == 5 * n and planes == 3 * n + 2
    original_volume = volume(shape)
    assert original_volume > 0
    # Demonstrate a standard CAD operation on imported analytic geometry.
    if n in [112, 192]:
        cut = BRepAlgoAPI_Cut(shape, BRepPrimAPI_MakeCylinder(3, 9).Shape())
        cut.Build()
        assert cut.IsDone() and BRepCheck_Analyzer(cut.Shape()).IsValid()
        assert count(cut.Shape(), TopAbs_SOLID) == 1
        assert abs(original_volume - volume(cut.Shape()) - math.pi * 3 ** 2 * 9) < 1e-5
    return {'teeth': n, 'valid_solid': True, 'width_mm': zmax - zmin,
            'cylindrical_faces': cylinders, 'planar_faces': planes,
            'volume_mm3': original_volume, 'mounting_hole_boolean_checked': n in [112, 192]}


if __name__ == '__main__':
    results = []
    with tempfile.TemporaryDirectory() as folder:
        for n in COUNTS:
            path = Path(folder) / f'{n}.step'
            subprocess.run(['node', '-e',
                "require('fs').writeFileSync(process.argv[1],require('./pulley-step').step(Number(process.argv[2])))",
                str(path), str(n)], cwd=ROOT, check=True)
            row = check_file(path, n)
            results.append(row)
            print(f'{n}T: valid analytic solid, 9 mm width, {row["cylindrical_faces"]} cylindrical faces', flush=True)
    report = {'method': 'Independent Open Cascade STEP import, topology, analytic surface and CAD boolean checks',
              'cases': results, 'limitations': ['SOLIDWORKS itself was not available for an application-specific import test.',
              'Checks CAD export integrity; no new physical belt-fit or load claims.']}
    (Path(__file__).parent / 'step-results.json').write_text(json.dumps(report, indent=2) + '\n')
