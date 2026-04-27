const WMO = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Foggy',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
  80: 'Showers', 81: 'Showers', 82: 'Heavy showers',
  85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm',
}

export async function fetchWeather(lat, lng, timestamp) {
  const date = new Date(timestamp)
  const dateStr = date.toISOString().slice(0, 10)
  const daysAgo = (Date.now() - timestamp) / 86400000

  let url, params

  if (daysAgo <= 90) {
    // Forecast API: past_days and start_date/end_date are mutually exclusive —
    // use past_days only and match the target date in the returned time array
    url = 'https://api.open-meteo.com/v1/forecast'
    params = new URLSearchParams({
      latitude: lat.toFixed(4),
      longitude: lng.toFixed(4),
      hourly: 'temperature_2m,weather_code',
      timezone: 'auto',
      temperature_unit: 'fahrenheit',
      past_days: String(Math.min(92, Math.ceil(daysAgo) + 1)),
      forecast_days: '1',
    })
  } else {
    // Archive API: start_date/end_date required
    url = 'https://archive-api.open-meteo.com/v1/archive'
    params = new URLSearchParams({
      latitude: lat.toFixed(4),
      longitude: lng.toFixed(4),
      start_date: dateStr,
      end_date: dateStr,
      hourly: 'temperature_2m,weather_code',
      timezone: 'auto',
      temperature_unit: 'fahrenheit',
    })
  }

  const res = await fetch(`${url}?${params}`)
  if (!res.ok) return null
  const data = await res.json()

  const { temperature_2m: temps, weather_code: codes, time: times } = data.hourly ?? {}
  if (!temps || !codes || !times) return null

  // Match exact date+hour e.g. "2024-03-15T10:00"
  const target = `${dateStr}T${String(date.getHours()).padStart(2, '0')}:00`
  const idx = times.indexOf(target)
  if (idx === -1) return null

  return {
    temp: Math.round(temps[idx]),
    condition: WMO[codes[idx]] ?? null,
  }
}
