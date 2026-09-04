from pathlib import Path

from src.Environment import Environment
from src.LIDARScanner import LIDARScanner
from src.Simulation import Simulation


BASE_DIR = Path(__file__).resolve().parent.parent
MapPath = BASE_DIR / "maps" / "FloorPlan2.png"

env = Environment(str(MapPath))

scanner = LIDARScanner(
    (0, 0),
    env,
    Range=120,
    DistanceNoise=0.1,
    AngleNoise=0.03,
    ScanFrequency=30,
    NumAngles=30,
    ProximityThreshold=4
)

simulation = Simulation(env, scanner)
simulation.Run()