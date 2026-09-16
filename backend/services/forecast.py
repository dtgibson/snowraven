"""Forecast-tier selection + the readable summary for the Current/Predict
lookups (web/Pi twin of frontend/src/lib/forecastSlice.ts). Pure; no I/O.

A single base One Call 3.0 response (current + hourly + daily) is sliced to the
right resolution for a target moment:

  - current     → "now" (within ~1h of the response's current time)
  - hourly      → an exact hour, up to ~48h out
  - daily       → a whole-day summary, ~48h to ~8 days out
  - out-of-range→ beyond the forecast horizon (no weather; tide still shows)

The chosen slice is adapted into the timemachine `{data:[hour]}` shape the
existing format_weather already consumes, so the copy block stays byte-identical
to the checklist lookup (one formatter). The summary carries the structured
fields the readable at-a-glance view renders.
"""

from zoneinfo import ZoneInfo

from formatters.weather import (
    condition_emoji, wind_description, cardinal, format_local_time,
    moon_phase_emoji, format_weather, assert_hour_reading, is_finite_figure,
)

# Tier boundaries (seconds). The hourly array covers ~48h, daily ~8 days; we add a
# small slack so a target right at a boundary still resolves.
_NOW_SLACK = 3600          # within ±1h of "now" → current
_HOURLY_SLACK = 1800       # 30 min past the last hourly point still counts
_DAILY_SLACK = 43200       # daily dt is local noon; 12h past the last noon = end of that day


def _or_dt(value, dt):
    """`??`, not `.get(key, default)`.

    The TS twin writes `d.sunrise ?? d.dt`, which treats an explicit null
    exactly as an absent key. `.get("sunrise", dt)` fires only on an absent KEY,
    so a body carrying `"sunrise": null` refused on web/Pi (TypeError out of
    `datetime.fromtimestamp(None)`) and rendered a dt-derived time on desktop.
    Same three characters of meaning, measured as a real divergence.
    """
    return dt if value is None else value


def _usable(raw) -> list:
    """The entries of one tier that can take part in the search at all: a dict
    carrying a usable `dt`. Twin of `usableEntries` in
    frontend/src/lib/forecastSlice.ts, and the same boundary filter
    `build_weather_plan` has applied since v1.0.29.

    Two accidents of the two languages made this asymmetric, both measured:

      * The HORIZON. `.get("dt", 0)` fires only on an absent KEY, so a
        present-but-null dt reached `None + 1800` and RAISED here, while
        `targetTs <= null + 1800` is merely false on the TS side and fell
        through to the daily tier — the same body was a 502 on web/Pi and a real
        daily reading on desktop.
      * The NEAREST-ENTRY SEARCH. A single malformed `dt` anywhere in the
        48-hour array — by far the likeliest real provider hiccup — raised out
        of this `min` key function, while `Math.abs(NaN) < x` is false so the TS
        reduce skipped it and answered with a valid neighbour.

    Filtering resolves all of it in one place and in the direction that keeps
    the answer, and it retires the `.get("dt", 0)` sentinel — a figure defaulted
    to zero, of exactly the kind this build exists to remove. An entry that IS
    selected is still refused by `assert_hour_reading` if any other figure of it
    is malformed. A conforming body has every entry usable, so the filter is the
    identity and the selected slice is unchanged, byte for byte.
    """
    if not isinstance(raw, list):
        return []
    return [e for e in raw if isinstance(e, dict) and is_finite_figure(e.get("dt"))]


def pick_forecast_slice(onecall: dict, target_ts):
    """Return (resolution, slice) for `target_ts` (epoch seconds, or None = now).
    `slice` is the raw current/hourly/daily object, or None when out-of-range."""
    # The `current` horizon is read the same way as the other two: through
    # `is_finite_figure`, because `now is not None` reached
    # `abs(target_ts - "warm")` and RAISED where `Math.abs(t - "warm")` is
    # merely NaN and falls through to the next tier. Its TS twin reads the same
    # predicate for the same reason.
    #
    # THE PRESENCE TEST IS `is not None`, AND ITS TWIN IS `isPresent` RATHER
    # THAN TRUTHINESS -- both halves of that swap, because deriving only one of
    # them is what shipped a fresh divergence out of this very function (QA
    # finding F-1, closed here):
    #
    #   * WIDENING, `if current` -> `is not None`. Python `{}` and `[]` are
    #     falsy, so this side answered out-of-range for an empty `current` block
    #     while the other treated it as present and refused it as malformed.
    #     Fixed by the swap.
    #   * INVERSION, the half that was missed. `0`, `False` and `""` are falsy
    #     in BOTH of the old spellings and are `is not None`, so the swap turned
    #     three shapes that AGREED at v1.0.31 (out-of-range on both) into a 502
    #     here against an out-of-range 200 there. The other side now tests
    #     presence rather than truthiness too, so the two agree by construction
    #     instead of by coincidence.
    #
    # Presence means "the provider sent something under this key"; whether what
    # it sent is USABLE is `assert_hour_reading`'s question, which is decision 1
    # of this build applied to the presence test itself. Absent and explicit
    # null are the only out-of-range answers, on both runtimes, unchanged --
    # One Call legitimately omits `current` via `exclude`, and with no `dt`
    # target there is no other tier to answer from.
    current = onecall.get("current")
    now = current.get("dt") if isinstance(current, dict) else None

    if target_ts is None or (is_finite_figure(now) and abs(target_ts - now) <= _NOW_SLACK):
        return ("current", current) if current is not None else ("out-of-range", None)

    hourly = _usable(onecall.get("hourly"))
    if hourly and target_ts <= hourly[-1]["dt"] + _HOURLY_SLACK:
        nearest = min(hourly, key=lambda h: abs(h["dt"] - target_ts))
        return ("hourly", nearest)

    daily = _usable(onecall.get("daily"))
    if daily and target_ts <= daily[-1]["dt"] + _DAILY_SLACK:
        nearest = min(daily, key=lambda d: abs(d["dt"] - target_ts))
        return ("daily", nearest)

    return ("out-of-range", None)


def _hour_from_point(point: dict, onecall: dict) -> dict:
    """ONE adapter for the `current` and `hourly` tiers, as the TS twin's single
    `hourData` has always been.

    There used to be a separate `_hour_from_current` returning the block
    untouched, on the comment "current already carries every field
    format_weather reads (incl. sunrise/sunset)". That is not true of a
    well-formed body: One Call OMITS `sunrise`/`sunset` for polar day and polar
    night, and the TS twin injects them from the matching daily entry on this
    tier too. Measured: a `current` block with `sunrise` absent answered 502 on
    web/Pi and rendered on desktop -- a live divergence for high-latitude users,
    found only because the shared matrix carried the row.

    A well-formed body with both keys present takes the `if` false and comes
    back `dict(point)`, so the byte-golden output is untouched.

    The selected slice is a DICT or it is refused here, explicitly, rather than
    incidentally by `dict(0)` raising two lines down. The `hourly` tier cannot
    reach that branch (`_usable` has already filtered to dicts); the `current`
    tier can, because `pick_forecast_slice`'s presence test deliberately admits
    every non-None value and leaves the validity question to the validator.
    """
    if not isinstance(point, dict):
        raise TypeError("malformed provider entry: the selected slice is not an object")
    h = dict(point)
    if "sunrise" not in h or "sunset" not in h:
        daily = _usable(onecall.get("daily"))
        day = min(daily, key=lambda d: abs(d["dt"] - h["dt"])) if (daily and is_finite_figure(h.get("dt"))) else {}
        # `h.get("dt")`, never `h.get("dt", 0)`: the TS twin's `?? h.dt` yields
        # undefined for an entry with no dt, so a 0 here would make this side
        # accept a sunrise the other side refuses.
        h["sunrise"] = _or_dt(day.get("sunrise"), h.get("dt"))
        h["sunset"] = _or_dt(day.get("sunset"), h.get("dt"))
    return h


def _hour_from_daily(daily: dict, temp: dict) -> dict:
    """A daily entry flattened to the hour shape the formatter consumes.

    NOTHING IS DEFAULTED HERE ANY MORE, and that is this build. Every field used
    to arrive through `.get(field, 0)` and `weather` through
    `or _FALLBACK_WEATHER`, so a daily entry carrying only `dt` produced a
    complete-looking reading of zeroes under a fabricated "Clear sky":
    `GET /weather/at` answered **HTTP 200** with `☀️ | Clear sky | Temperature:
    55 - 74°F` for a body the provider sent no weather in. Because the default
    landed BEFORE anything could refuse it, this was the tier on which the
    divergence inverted -- desktop refused these and web/Pi did not.

    `sunrise`/`sunset` keep their dt fallback, deliberately: One Call OMITS them
    for polar day and polar night, so refusing an absent sunrise would refuse
    well-formed high-latitude bodies. That fallback is pre-existing and agreed
    across both runtimes; `_or_dt` is what makes an explicit null behave as
    absent, matching `??`.

    A dt-derived "Sunrise" is itself a wrong figure -- just an agreeing one now
    -- and the fallback is NOT daily-tier-only: `_hour_from_point` above runs
    the same substitution for the `current` and `hourly` tiers. So a TRUE polar
    body, with sun times absent on the selected point AND on every daily entry,
    reports Sunrise and Sunset both equal to the reading's own timestamp, on
    either tier and on both runtimes. That is out of this build's scope rather
    than half-changed in it, and is handed to the Chronicler as a ROADMAP.md
    candidate at closeout (nothing in ROADMAP.md names it yet); decision 5
    carries the measurement and the reversal condition.
    """
    return {
        "dt": daily.get("dt"),
        "temp": temp.get("day"),
        "humidity": daily.get("humidity"),
        "dew_point": daily.get("dew_point"),
        "wind_speed": daily.get("wind_speed"),
        "wind_deg": daily.get("wind_deg"),
        "clouds": daily.get("clouds"),
        "weather": daily.get("weather"),
        "sunrise": _or_dt(daily.get("sunrise"), daily.get("dt")),
        "sunset": _or_dt(daily.get("sunset"), daily.get("dt")),
    }


def _summary_from_hour(hour: dict, tz: ZoneInfo, lat: float, is_daily: bool, high=None, low=None) -> dict:
    # `hour` has been through assert_hour_reading, so weather[0] is a dict
    # carrying a finite id and a str description: no `or _FALLBACK_WEATHER`, and
    # every round() below is over a figure already known to be finite.
    owm = hour["weather"][0]
    is_night = (not is_daily) and (hour["dt"] < hour["sunrise"] or hour["dt"] > hour["sunset"])
    return {
        "emoji": condition_emoji(owm["id"]),
        "moon": moon_phase_emoji(hour["dt"], lat) if is_night else "",
        "description": owm["description"].capitalize(),
        "isDaily": is_daily,
        "tempF": round(hour["temp"]),
        "highF": round(high) if high is not None else None,
        "lowF": round(low) if low is not None else None,
        "windDesc": wind_description(hour["wind_speed"]),
        "windDir": cardinal(hour["wind_deg"]),
        "cloudsPct": round(hour["clouds"]),
        "humidityPct": round(hour["humidity"]),
        "dewPointF": round(hour["dew_point"]),
        "sunrise": format_local_time(hour["sunrise"], tz),
        "sunset": format_local_time(hour["sunset"], tz),
        "isNight": is_night,
    }


def build_weather_payload(onecall: dict, target_ts, tz: ZoneInfo, lat: float) -> dict:
    """Slice → adapted formatter input + structured summary. Returns
    {resolution, formatted, summary}; formatted/summary are None when
    out-of-range.

    REFUSES a malformed slice rather than producing a payload with a hole in it.
    `services/plan_weather.py` and its TS twin are supposed to agree on what a
    malformed figure is (v1.0.29), and BOTH delegate here -- so their agreement
    was only ever as good as this function's, and on the `daily` tier this
    function had no refusal at all: `_hour_from_daily` defaulted the value away
    first. The route maps the raise to its existing 502 + "Weather data
    unavailable for this location." (containment closed at v1.0.31).
    """
    resolution, sl = pick_forecast_slice(onecall, target_ts)
    if resolution == "out-of-range":
        return {"resolution": "out-of-range", "formatted": None, "summary": None}

    if resolution == "daily":
        # The daily `temp` CONTAINER is checked before its members: an absent or
        # non-object `temp` is the shape that used to flatten to three zeroes
        # (`tempF: 0`, `H 0° · L 0°`) over a body with no temperature in it.
        raw = sl.get("temp") if isinstance(sl, dict) else None
        if not isinstance(raw, dict):
            raise TypeError("malformed provider entry: daily temp is not an object")
        lo, hi = raw.get("min"), raw.get("max")
        if not is_finite_figure(lo) or not is_finite_figure(hi):
            raise TypeError("malformed provider entry: a daily temp bound is not a finite number")
        hour = _hour_from_daily(sl, raw)
        assert_hour_reading(hour)
        # Two synthetic points (min, max) so the copy block's Temperature line reads
        # as a daily low–high range via the existing format_range.
        responses = [{"data": [dict(hour, temp=lo)]}, {"data": [dict(hour, temp=hi)]}]
        summary = _summary_from_hour(hour, tz, lat, is_daily=True, high=hi, low=lo)
    else:
        hour = _hour_from_point(sl, onecall)
        assert_hour_reading(hour)
        responses = [{"data": [hour]}]
        summary = _summary_from_hour(hour, tz, lat, is_daily=False)

    return {
        "resolution": resolution,
        "formatted": format_weather(responses, tz, lat),
        "summary": summary,
    }
