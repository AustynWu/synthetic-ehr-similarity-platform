# services/detail_views.py — chart data for the variable detail panel
#
# Called by evaluation.py once per selected column to produce the bar chart
# data that the frontend renders when a user clicks a row in the variable table.

import pandas as pd
from schemas import DataTypeLabel, DetailViewSeries


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
        all_cats = sorted(set(real_col.dropna().unique()) | set(syn_col.dropna().unique()))
        real_prop = real_col.value_counts(normalize=True)
        syn_prop  = syn_col.value_counts(normalize=True)
        return [
            DetailViewSeries(
                label=str(cat),
                real=round(float(real_prop.get(cat, 0.0)), 4),
                synthetic=round(float(syn_prop.get(cat, 0.0)), 4),
            )
            # Cap at 20 bars — more categories become unreadable in the UI chart.
            for cat in all_cats[:20]
        ]

    # Numerical: define bins from the real column's range.
    col_min = float(real_col.min())
    col_max = float(real_col.max())
    bins = pd.cut(real_col, bins=10, include_lowest=True)
    bin_labels = [str(b) for b in bins.cat.categories]

    real_counts = pd.cut(
        real_col, bins=bins.cat.categories, include_lowest=True
    ).value_counts(normalize=True, sort=False)

    # clip() maps synthetic values outside [col_min, col_max] to the edge bins
    # instead of dropping them, so the synthetic proportions still sum to ~1.
    syn_counts = pd.cut(
        syn_col.clip(col_min, col_max), bins=bins.cat.categories, include_lowest=True
    ).value_counts(normalize=True, sort=False)

    return [
        DetailViewSeries(
            label=label,
            real=round(float(real_counts.get(cat, 0.0)), 4),
            synthetic=round(float(syn_counts.get(cat, 0.0)), 4),
        )
        for label, cat in zip(bin_labels, bins.cat.categories)
    ]
