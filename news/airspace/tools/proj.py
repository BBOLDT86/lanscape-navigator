"""The map's projection: us-atlas's Albers USA (d3.geoAlbersUsa().scale(1300).translate([487.5, 305])), lower-48 part,
applied without its clip so aircraft over Canada, Mexico and the oceans land where the map would continue."""
import math
_K, _TX, _TY = 1300.0, 487.5, 305.0
_P0, _P1 = math.radians(29.5), math.radians(45.5)
_SY0 = math.sin(_P0); _N = (_SY0 + math.sin(_P1)) / 2; _C = 1 + _SY0 * (2 * _N - _SY0); _R0 = math.sqrt(_C) / _N
def _raw(lam, phi):
    r = math.sqrt(max(_C - 2 * _N * math.sin(phi), 0.0)) / _N
    return r * math.sin(lam * _N), _R0 - r * math.cos(lam * _N)
_CX, _CY = _raw(math.radians(-0.6), math.radians(38.7))
def project(lon, lat):
    x, y = _raw(math.radians(lon + 96.0), math.radians(lat))
    return _TX + _K * (x - _CX), _TY - _K * (y - _CY)
