from zoneinfo import ZoneInfo

from formatters.weather import (
    cardinal,
    condition_emoji,
    format_local_time,
    format_range,
    format_weather,
    moon_phase_emoji,
    wind_description,
)

TZ_ET = ZoneInfo("America/New_York")

LAT_N = 40.7128
LAT_S = -33.8688


class TestWindDescription:
    def test_calm(self):
        assert wind_description(0) == "Calm"
        assert wind_description(1) == "Calm"

    def test_mostly_calm(self):
        assert wind_description(2) == "Mostly calm"
        assert wind_description(3) == "Mostly calm"

    def test_light_breeze(self):
        assert wind_description(4) == "Light breeze"
        assert wind_description(7) == "Light breeze"

    def test_gentle_breeze(self):
        assert wind_description(8) == "Gentle breeze"
        assert wind_description(12) == "Gentle breeze"

    def test_gale(self):
        assert wind_description(50) == "Gale"


class TestCardinal:
    def test_north(self):
        assert cardinal(0) == "N"
        assert cardinal(360) == "N"

    def test_east(self):
        assert cardinal(90) == "E"

    def test_south(self):
        assert cardinal(180) == "S"

    def test_west(self):
        assert cardinal(270) == "W"

    def test_northwest(self):
        assert cardinal(315) == "NW"


class TestConditionEmoji:
    def test_thunderstorm(self):
        assert condition_emoji(200) == "⛈️"
        assert condition_emoji(232) == "⛈️"

    def test_clear(self):
        assert condition_emoji(800) == "☀️"

    def test_overcast(self):
        assert condition_emoji(804) == "☁️"

    def test_snow(self):
        assert condition_emoji(601) == "❄️"

    def test_unknown(self):
        assert condition_emoji(999) == "🌡️"


class TestFormatRange:
    def test_equal_values(self):
        assert format_range([54.0, 54.0], "°F") == "54°F"

    def test_range(self):
        assert format_range([54.0, 55.4], "°F") == "54 - 55°F"

    def test_humidity_range(self):
        assert format_range([86, 92], "%") == "86 - 92%"

    def test_single_value_rounds(self):
        assert format_range([54.4], "°F") == "54°F"


class TestFormatLocalTime:
    def test_morning(self):
        # 2024-05-01 06:08 ET = Unix 1714558080
        import datetime
        dt = datetime.datetime(2024, 5, 1, 6, 8, tzinfo=TZ_ET)
        ts = int(dt.timestamp())
        assert format_local_time(ts, TZ_ET) == "6:08am"

    def test_afternoon(self):
        import datetime
        dt = datetime.datetime(2024, 5, 1, 20, 3, tzinfo=TZ_ET)
        ts = int(dt.timestamp())
        assert format_local_time(ts, TZ_ET) == "8:03pm"

    def test_noon(self):
        import datetime
        dt = datetime.datetime(2024, 5, 1, 12, 0, tzinfo=TZ_ET)
        ts = int(dt.timestamp())
        assert format_local_time(ts, TZ_ET) == "12:00pm"


class TestFormatWeather:
    def _make_response(self, dt=1714559400, temp=54.0, humidity=89, dew_point=51.5,
                       wind_speed=8.3, wind_deg=270, clouds=100,
                       weather_id=804, description="overcast clouds",
                       sunrise=1714554480, sunset=1714603980):
        # Default dt (2024-05-01 06:30 ET) sits between sunrise and sunset → day.
        return {
            "data": [{
                "dt": dt,
                "temp": temp,
                "humidity": humidity,
                "dew_point": dew_point,
                "wind_speed": wind_speed,
                "wind_deg": wind_deg,
                "clouds": clouds,
                "weather": [{"id": weather_id, "description": description}],
                "sunrise": sunrise,
                "sunset": sunset,
            }]
        }

    def test_output_contains_required_fields(self):
        resp = self._make_response()
        result = format_weather([resp], TZ_ET, LAT_N)
        assert "Temperature:" in result
        assert "Wind:" in result
        assert "Wind Direction:" in result
        assert "Cloud Cover:" in result
        assert "Humidity:" in result
        assert "Dew point:" in result
        assert "Sunrise:" in result
        assert "Sunset:" in result
        assert "SnowRaven" in result

    def test_attribution_contains_link(self):
        resp = self._make_response()
        result = format_weather([resp], TZ_ET, LAT_N)
        assert 'href="https://github.com/dtgibson/snowraven"' in result

    def test_overcast_emoji(self):
        resp = self._make_response(weather_id=804)
        result = format_weather([resp], TZ_ET, LAT_N)
        assert result.startswith("☁️")

    def test_temperature_range_across_hours(self):
        r1 = self._make_response(temp=54.0)
        r2 = self._make_response(temp=56.0)
        result = format_weather([r1, r2], TZ_ET, LAT_N)
        assert "54 - 56°F" in result

    def test_single_temperature_no_dash(self):
        resp = self._make_response(temp=54.0)
        result = format_weather([resp], TZ_ET, LAT_N)
        assert "54°F" in result
        assert "54 - 54°F" not in result

    def test_wind_range_across_hours(self):
        r1 = self._make_response(wind_speed=5.0)   # Light breeze
        r2 = self._make_response(wind_speed=10.0)  # Gentle breeze
        result = format_weather([r1, r2], TZ_ET, LAT_N)
        assert "Light breeze - Gentle breeze" in result

    def test_west_cardinal(self):
        resp = self._make_response(wind_deg=270)
        result = format_weather([resp], TZ_ET, LAT_N)
        assert "Wind Direction: W" in result

    def test_day_block_has_no_moon(self):
        resp = self._make_response()
        result = format_weather([resp], TZ_ET, LAT_N)
        assert result.startswith("☁️\n")

    def test_night_block_appends_moon_unspaced(self):
        # dt before sunrise → night; 1714550000 → Last Quarter 🌗 (north).
        resp = self._make_response(dt=1714550000)
        result = format_weather([resp], TZ_ET, LAT_N)
        assert result.startswith("☁️🌗\n")

    def test_night_block_southern_hemisphere_mirrors(self):
        resp = self._make_response(dt=1714550000)
        result = format_weather([resp], TZ_ET, LAT_S)
        assert result.startswith("☁️🌓\n")

    def test_any_night_hour_makes_night_block_phase_from_first(self):
        # First hour is day, second is after sunset — the block is a night
        # block and the phase comes from the FIRST hour's dt.
        r1 = self._make_response()                  # day (dt=1714559400)
        r2 = self._make_response(dt=1714607580)     # sunset + 3600 → night
        result = format_weather([r1, r2], TZ_ET, LAT_N)
        assert result.startswith("☁️" + moon_phase_emoji(1714559400, LAT_N) + "\n")


class TestMoonPhaseEmoji:
    # Timestamps from the golden oracle's "one timestamp per phase bin"
    # section (lunation k=300 of the 2451550.1 reference epoch).
    BIN_CASES = [
        (1712679233, "🌑", "🌑"),  # New
        (1712921153, "🌒", "🌘"),  # Waxing Crescent
        (1713240833, "🌓", "🌗"),  # First Quarter
        (1713560513, "🌔", "🌖"),  # Waxing Gibbous
        (1713880193, "🌕", "🌕"),  # Full
        (1714199873, "🌖", "🌔"),  # Waning Gibbous
        (1714510913, "🌗", "🌓"),  # Last Quarter
        (1714830593, "🌘", "🌒"),  # Waning Crescent
        (1715089793, "🌑", "🌑"),  # wraps back to New past the last bound
    ]

    def test_northern_hemisphere_bins(self):
        for ts, north, _south in self.BIN_CASES:
            assert moon_phase_emoji(ts, LAT_N) == north

    def test_southern_hemisphere_mirrors(self):
        for ts, _north, south in self.BIN_CASES:
            assert moon_phase_emoji(ts, LAT_S) == south

    def test_equator_uses_northern_set(self):
        assert moon_phase_emoji(1713560513, 0.0) == "🌔"
