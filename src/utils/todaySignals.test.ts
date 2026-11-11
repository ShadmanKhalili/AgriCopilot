import { describe, expect, it } from 'vitest';
import {
  fertiliseSignal,
  irrigateSignal,
  signalsSpeech,
  spraySignal,
  todaySignals,
  todayWeatherFromFeed,
  type TodayWeather,
} from './todaySignals';

const calm: TodayWeather = {
  temp: 26,
  humidity: 60,
  windSpeed: 6,
  rainChanceToday: 5,
  rainChanceNext12h: 5,
};

describe('spraySignal', () => {
  it('allows spraying in calm dry weather', () => {
    expect(spraySignal(calm).status).toBe('go');
  });

  it('stops spraying when rain is likely today or in the next hours', () => {
    expect(spraySignal({ ...calm, rainChanceToday: 50 }).status).toBe('stop');
    expect(spraySignal({ ...calm, rainChanceNext12h: 70 }).status).toBe('stop');
  });

  it('stops spraying in strong wind', () => {
    expect(spraySignal({ ...calm, windSpeed: 21 }).status).toBe('stop');
  });

  it('asks to pick a calm, cool time when it is breezy, hot or rain is possible', () => {
    expect(spraySignal({ ...calm, windSpeed: 15 }).status).toBe('wait');
    expect(spraySignal({ ...calm, temp: 34 }).status).toBe('wait');
    expect(spraySignal({ ...calm, rainChanceToday: 25 }).status).toBe('wait');
  });
});

describe('irrigateSignal', () => {
  it('says no irrigation is needed when rain is likely or the soil is wet', () => {
    expect(irrigateSignal({ ...calm, rainChanceToday: 60 }).status).toBe('stop');
    expect(irrigateSignal({ ...calm, soilMoisture: 0.36 }).status).toBe('stop');
  });

  it('says to irrigate when the soil is dry and rain is unlikely', () => {
    expect(irrigateSignal({ ...calm, soilMoisture: 0.2 }).status).toBe('go');
  });

  it('does not tell a farmer to irrigate dry soil when rain is likely', () => {
    expect(irrigateSignal({ ...calm, soilMoisture: 0.2, rainChanceNext12h: 80 }).status).toBe('stop');
  });

  it('asks the farmer to check the soil when there is no soil reading', () => {
    expect(irrigateSignal(calm).status).toBe('wait');
    expect(irrigateSignal({ ...calm, soilMoisture: 0.28 }).status).toBe('wait');
  });
});

describe('fertiliseSignal', () => {
  it('follows the chance of rain', () => {
    expect(fertiliseSignal(calm).status).toBe('go');
    expect(fertiliseSignal({ ...calm, rainChanceToday: 30 }).status).toBe('wait');
    expect(fertiliseSignal({ ...calm, rainChanceToday: 55 }).status).toBe('stop');
  });
});

describe('todaySignals', () => {
  it('returns spray, irrigate and fertilise in that order, each in both languages', () => {
    const signals = todaySignals(calm);
    expect(signals.map((s) => s.kind)).toEqual(['spray', 'irrigate', 'fertilise']);
    for (const s of signals) {
      expect(s.title.bn && s.title.en && s.reason.bn && s.reason.en).toBeTruthy();
    }
    expect(signalsSpeech(signals, 'en')).toContain('You can spray today');
  });
});

describe('todayWeatherFromFeed', () => {
  const feed = {
    current: { time: '2026-11-12T10:00', temperature_2m: 27.4, relative_humidity_2m: 71, wind_speed_10m: 9 },
    hourly: {
      time: ['2026-11-12T08:00', '2026-11-12T09:00', '2026-11-12T10:00', '2026-11-12T11:00', '2026-11-12T12:00'],
      precipitation_probability: [90, 90, 10, 65, 20],
    },
    daily: { precipitation_probability_max: [40] },
    agro_metrics: { soil_moisture_0_7cm: 0.31 },
  };

  it('reads the current numbers', () => {
    const w = todayWeatherFromFeed(feed)!;
    expect(w.temp).toBe(27.4);
    expect(w.humidity).toBe(71);
    expect(w.windSpeed).toBe(9);
    expect(w.rainChanceToday).toBe(40);
    expect(w.soilMoisture).toBe(0.31);
  });

  it('looks only at hours from now on for the next-12-hours chance', () => {
    expect(todayWeatherFromFeed(feed)!.rainChanceNext12h).toBe(65);
  });

  it('falls back to the daily chance when there is no hourly data', () => {
    const w = todayWeatherFromFeed({ current: feed.current, daily: feed.daily })!;
    expect(w.rainChanceNext12h).toBe(40);
    expect(w.soilMoisture).toBeUndefined();
  });

  it('returns null without a current reading', () => {
    expect(todayWeatherFromFeed(null)).toBeNull();
    expect(todayWeatherFromFeed({ current: {} })).toBeNull();
  });
});
