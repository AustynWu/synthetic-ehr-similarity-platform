# services/detail_views.py — chart data for the variable detail panel
#
# Called by evaluation.py once per selected column to produce the bar chart
# data that the frontend renders when a user clicks a row in the variable table.

import math
import pandas as pd
from schemas import DataTypeLabel, DetailViewSeries

_MAX_CATEGORICAL_BARS = 20  # more bars become unreadable in the UI chart
_HISTOGRAM_BINS = 10        # bin count for numerical distribution charts


def build_detail_series(
    real_col: pd.Series,
    syn_col: pd.Series,
    col_type: DataTypeLabel,
) -> list[DetailViewSeries]:
    """
    Build side-by-side bar chart data for one variable.

    Categorical: one bar pair per category, showing proportion in real vs synthetic.
    Numerical:   10 equal-width histogram bins, showing distribution shape.

    Why proportions instead of raw counts?
    Real and synthetic datasets often have different row counts.  Using raw counts
    would make the bars incomparable — a synthetic dataset with 5× more rows would
    always appear taller even if the distributions were identical.  Proportions
    normalise for size so the chart shows shape, not volume.

    Why use the real column's range to define the bins for numerical columns?
    Both datasets must be bucketed with the same bin edges so the bars line up
    side-by-side.  Using the real range as the reference makes the chart show
    how well the synthetic data covers the real data's value range.
    Synthetic values outside that range are clipped so they still fall into the
    edge bins rather than being silently dropped.
    """
    if col_type == DataTypeLabel.categorical:
        all_cats = sorted(
            set(real_col.dropna().unique()) | set(syn_col.dropna().unique())
        )
        real_prop = real_col.value_counts(normalize=True)
        real_raw  = real_col.value_counts(normalize=False)
        syn_prop  = syn_col.value_counts(normalize=True)
        syn_raw   = syn_col.value_counts(normalize=False)
        return [
            DetailViewSeries(
                label=str(cat),
                real=round(float(real_prop.get(cat, 0.0)), 4),
                synthetic=round(float(syn_prop.get(cat, 0.0)), 4),
                realCount=int(real_raw.get(cat, 0)),
                syntheticCount=int(syn_raw.get(cat, 0)),
            )
            for cat in all_cats[:_MAX_CATEGORICAL_BARS]
        ]

    # Numerical: build histogram bins from the real column's range.
    real_clean = real_col.dropna()
    n_unique = int(real_clean.nunique())

    try:
        is_integer_col = bool((real_clean == real_clean.astype(int)).all())
    except (ValueError, OverflowError):
        is_integer_col = False

    if is_integer_col and n_unique <= 20:
        # Use value_counts so each integer gets its own label ("1", "2", ...).
        # pd.cut would merge values 1 and 2 into one bin [1,2], giving the "1-2" range label.
        col_min_int = int(real_clean.min())
        col_max_int = int(real_clean.max())
        real_prop = real_col.value_counts(normalize=True)
        real_raw  = real_col.value_counts(normalize=False)
        syn_clip  = syn_col.clip(col_min_int, col_max_int)
        syn_prop  = syn_clip.value_counts(normalize=True)
        syn_raw   = syn_clip.value_counts(normalize=False)
        return [
            DetailViewSeries(
                label=str(v),
                real=round(float(real_prop.get(v, 0.0)), 4),
                synthetic=round(float(syn_prop.get(v, 0.0)), 4),
                binLeft=float(v),
                binRight=float(v + 1),
                realCount=int(real_raw.get(v, 0)),
                syntheticCount=int(syn_raw.get(v, 0)),
            )
            for v in range(col_min_int, col_max_int + 1)
        ]

    elif is_integer_col:
        col_min_int = int(real_clean.min())
        col_max_int = int(real_clean.max())
        # Round bin_width up to the nearest standard interval (1, 2, 5, 10, 20 ...).
        # This keeps x-axis edges at clean numbers like 0, 10, 20 instead of 1, 10, 19, 28.
        raw_width = max(1, math.ceil((col_max_int - col_min_int + 1) / _HISTOGRAM_BINS))
        _NICE_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000]
        bin_width = next((n for n in _NICE_STEPS if n >= raw_width), raw_width)
        # Start from the largest multiple of bin_width at or below col_min_int (usually 0).
        bin_start = (col_min_int // bin_width) * bin_width
        edges = []
        v = bin_start
        while v <= col_max_int:
            edges.append(v)
            v += bin_width
        edges.append(v)  # one closing edge beyond col_max_int
        real_cut = pd.cut(real_col.clip(col_min_int, col_max_int), bins=edges, include_lowest=True)
        syn_clip = syn_col.clip(col_min_int, col_max_int)
        # Return early with non-overlapping labels.
        # First bin [min, edge] is inclusive on the left — display left as-is.
        # Other bins (left, right] are exclusive on the left — display left+1.
        categories = real_cut.cat.categories
        real_counts = real_cut.value_counts(normalize=True, sort=False)
        real_raw    = real_cut.value_counts(normalize=False, sort=False)
        syn_cut     = pd.cut(syn_clip, bins=categories, include_lowest=True)
        syn_counts  = syn_cut.value_counts(normalize=True, sort=False)
        syn_raw     = syn_cut.value_counts(normalize=False, sort=False)
        return [
            DetailViewSeries(
                label=f"{int(cat.left) if i == 0 else int(cat.left) + 1}–{int(cat.right)}",
                real=round(float(real_counts.get(cat, 0.0)), 4),
                synthetic=round(float(syn_counts.get(cat, 0.0)), 4),
                binLeft=float(cat.left),
                binRight=float(cat.right),
                realCount=int(real_raw.get(cat, 0)),
                syntheticCount=int(syn_raw.get(cat, 0)),
            )
            for i, cat in enumerate(categories)
        ]

    else:
        # Float / continuous column — let pd.cut compute equal-width bin edges.
        real_cut = pd.cut(real_col, bins=_HISTOGRAM_BINS, include_lowest=True)
        col_min = float(real_col.min())
        col_max = float(real_col.max())
        syn_clip = syn_col.clip(col_min, col_max)

    # Shared return for the small-int and float branches.
    categories  = real_cut.cat.categories
    real_counts = real_cut.value_counts(normalize=True, sort=False)
    real_raw    = real_cut.value_counts(normalize=False, sort=False)
    # clip() keeps synthetic values inside the real range so proportions sum to ~1.
    syn_cut    = pd.cut(syn_clip, bins=categories, include_lowest=True)
    syn_counts = syn_cut.value_counts(normalize=True, sort=False)
    syn_raw    = syn_cut.value_counts(normalize=False, sort=False)

    def _fmt(v: float) -> str:
        return str(round(v))

    return [
        DetailViewSeries(
            label=f"{_fmt(cat.left)}–{_fmt(cat.right)}",
            real=round(float(real_counts.get(cat, 0.0)), 4),
            synthetic=round(float(syn_counts.get(cat, 0.0)), 4),
            binLeft=float(cat.left),
            binRight=float(cat.right),
            realCount=int(real_raw.get(cat, 0)),
            syntheticCount=int(syn_raw.get(cat, 0)),
        )
        for cat in categories
    ]
