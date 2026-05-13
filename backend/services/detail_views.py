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
        # One bin per value — keeps individual integer values on the x-axis.
        col_min_int = int(real_clean.min())
        col_max_int = int(real_clean.max())
        bin_edges = list(range(col_min_int, col_max_int + 2))
        real_cut = pd.cut(real_col, bins=bin_edges, include_lowest=True)
        syn_clip = syn_col.clip(col_min_int, col_max_int)

    elif is_integer_col:
        # Integer-aligned bins for large integer columns (> 20 unique values).
        # Avoids decimal bin edges that cause overlapping labels (e.g. "14–14").
        col_min_int = int(real_clean.min())
        col_max_int = int(real_clean.max())
        bin_width = max(1, math.ceil((col_max_int - col_min_int + 1) / _HISTOGRAM_BINS))
        edges = list(range(col_min_int, col_max_int + 1, bin_width))
        if edges[-1] <= col_max_int:
            edges.append(col_max_int + 1)
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
