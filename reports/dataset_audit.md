# Dataset audit

Source: `data/raw/ai4i2020.csv`. SHA-256: `dc6630cd9b1f0f853922fad78a1b6436570d3f1ec863f1dd5c4340ac56bc8a8e`.

Shape: 10,000 rows × 14 columns. Schema validation passed.
Duplicate complete rows: 0; duplicate feature rows: 0.

## Columns

Unique values are listed in full for up to ten values; otherwise the first ten sorted values are shown.

| Column | Inferred dtype | Missing | Unique | Values / sample |
| --- | --- | ---: | ---: | --- |
| UDI | int64 | 0 | 10000 | [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] |
| Product ID | str | 0 | 10000 | ['H29424', 'H29425', 'H29432', 'H29434', 'H29441', 'H29452', 'H29457', 'H29462', 'H29466', 'H29481'] |
| Type | str | 0 | 3 | ['H', 'L', 'M'] |
| Air temperature [K] | float64 | 0 | 93 | [295.3, 295.4, 295.5, 295.6, 295.7, 295.8, 295.9, 296.0, 296.1, 296.2] |
| Process temperature [K] | float64 | 0 | 82 | [305.7, 305.8, 305.9, 306.0, 306.1, 306.2, 306.3, 306.4, 306.5, 306.6] |
| Rotational speed [rpm] | int64 | 0 | 941 | [1168, 1181, 1183, 1192, 1200, 1202, 1207, 1208, 1212, 1217] |
| Torque [Nm] | float64 | 0 | 577 | [3.8, 4.2, 4.6, 5.6, 5.8, 8.0, 8.8, 9.3, 9.7, 9.8] |
| Tool wear [min] | int64 | 0 | 246 | [0, 2, 3, 4, 5, 6, 7, 8, 9, 10] |
| Machine failure | int64 | 0 | 2 | [0, 1] |
| TWF | int64 | 0 | 2 | [0, 1] |
| HDF | int64 | 0 | 2 | [0, 1] |
| PWF | int64 | 0 | 2 | [0, 1] |
| OSF | int64 | 0 | 2 | [0, 1] |
| RNF | int64 | 0 | 2 | [0, 1] |

## Distributions

Failure rate: 3.39%.

### Target counts

| Value | Count |
| --- | ---: |
| 0 | 9661 |
| 1 | 339 |

### Machine type counts

| Value | Count |
| --- | ---: |
| H | 1003 |
| L | 6000 |
| M | 2997 |

### Failure type counts

| Value | Count |
| --- | ---: |
| TWF | 46 |
| HDF | 115 |
| PWF | 95 |
| OSF | 98 |
| RNF | 19 |

### Failure label combinations

| Value | Count |
| --- | ---: |
| none | 9652 |
| HDF | 106 |
| PWF | 80 |
| OSF | 78 |
| TWF | 42 |
| RNF | 18 |
| PWF+OSF | 11 |
| HDF+OSF | 6 |
| HDF+PWF | 3 |
| TWF+OSF | 2 |
| TWF+RNF | 1 |
| TWF+PWF+OSF | 1 |

## Sensor statistics

| Sensor | Count | Mean | Std | Min | 25% | Median | 75% | Max |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Air temperature [K] | 10000.000 | 300.005 | 2.000 | 295.300 | 298.300 | 300.100 | 301.500 | 304.500 |
| Process temperature [K] | 10000.000 | 310.006 | 1.484 | 305.700 | 308.800 | 310.100 | 311.100 | 313.800 |
| Rotational speed [rpm] | 10000.000 | 1538.776 | 179.284 | 1168.000 | 1423.000 | 1503.000 | 1612.000 | 2886.000 |
| Torque [Nm] | 10000.000 | 39.987 | 9.969 | 3.800 | 33.200 | 40.100 | 46.800 | 76.600 |
| Tool wear [min] | 10000.000 | 107.951 | 63.654 | 0.000 | 53.000 | 108.000 | 162.000 | 253.000 |

## Potential outliers

Tukey fences (Q1 − 1.5 × IQR, Q3 + 1.5 × IQR) flag unusual readings, not invalid records. No rows were removed.

| Sensor | Lower fence | Upper fence | Flagged rows |
| --- | ---: | ---: | ---: |
| Air temperature [K] | 293.500 | 306.300 | 0 |
| Process temperature [K] | 305.350 | 314.550 | 0 |
| Rotational speed [rpm] | 1139.500 | 1895.500 | 418 |
| Torque [Nm] | 12.800 | 67.200 | 69 |
| Tool wear [min] | -110.500 | 325.500 | 0 |

## Identifier and label checks

- Duplicate identifiers: {'UDI': 0, 'Product ID': 0}.
- UDI is sequential from 1: True.
- Product ID prefix / Type mismatches: 0.
- Rows with overlapping failure labels: 24.
- Machine failure = 1 with no failure type (UDI): [1438, 2750, 4045, 4685, 5537, 5942, 6479, 8507, 9016].
- Machine failure = 0 with a failure type (UDI): [1222, 1303, 1749, 2073, 2560, 3066, 3453, 5472, 5490, 5496, 5510, 5554, 5640, 6092, 6914, 6961, 7489, 7869].

Interpretation and feature decisions are recorded in [milestone_1.md](milestone_1.md).
