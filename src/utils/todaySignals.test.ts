import { describe, expect, it } from 'vitest';
import {
  fertiliseSignal,
  irrigateSignal,
  signalsSpeech,
  spraySignal,
  todaySignals,
  todayWeatherFromFeed,
  weekSignalsFromFeed,
  type TodayWeather,
} from './todaySignals';
import { farmActionsFromFeed } from '../../netlify/functions/_shared/farm-actions';

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
    expect(w.rainChanceToday).toBe(65); // the rest of today, not the whole-day figure
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

describe('signals and the shared rules agree', () => {
  it('gives exactly the engine statuses for today', () => {
    const feed = {
      current: { time: '2026-11-12T10:00', temperature_2m: 30, relative_humidity_2m: 70, wind_speed_10m: 16 },
      daily: { time: ['2026-11-12'], precipitation_probability_max: [10] },
      agro_metrics: { soil_moisture_0_7cm: 0.4 },
    };
    const fromFeed = todaySignals(todayWeatherFromFeed(feed)!).map((s) => s.status);
    expect(fromFeed).toEqual(farmActionsFromFeed(feed)!.today.map((a) => a.status));
    expect(fromFeed).toEqual(['wait', 'stop', 'go']);
  });
});

describe('weekSignalsFromFeed', () => {
  const feed = {
    current: { time: '2026-11-12T10:00', temperature_2m: 27, relative_humidity_2m: 65, wind_speed_10m: 8 },
    daily: {
      time: ['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19'],
      precipitation_probability_max: [5, 80, 30, 5, 5, 5, 5, 5],
      temperature_2m_max: [29, 28, 30, 35, 30, 29, 28, 27],
      temperature_2m_min: [20, 21, 22, 23, 22, 21, 20, 19],
      wind_speed_10m_max: [12, 10, 10, 10, 25, 16, 10, 10],
    },
    agro_metrics: { soil_moisture_0_7cm: 0.2 },
  };

  it('returns up to 7 days with signals in order and the day numbers', () => {
    const week = weekSignalsFromFeed(feed);
    expect(week).toHaveLength(7);
    expect(week[0]).toMatchObject({ date: '2026-11-12', tempMax: 29, tempMin: 20, rainChance: 5 });
    for (const d of week) {
      expect(d.signals.map((s) => s.kind)).toEqual(['spray', 'irrigate', 'fertilise']);
      for (const s of d.signals) expect(s.title.bn && s.title.en && s.reason.bn && s.reason.en).toBeTruthy();
      expect(d.headline.bn && d.headline.en).toBeTruthy();
      expect(d.headline.en).not.toContain('%');
    }
  });

  it('chooses the headline by rule from the day', () => {
    const headlines = weekSignalsFromFeed(feed).map((d) => d.headline.en);
    expect(headlines).toEqual([
      'Good day to spray and fertilise. Irrigate too.',
      'Rain likely. Do not spray or fertilise.',
      'Rain possible. Check the sky before spraying or fertilising.',
      'Hot day. Spray early morning or evening.',
      'Strong wind. Do not spray.',
      'Breezy. Spray when the air is calm.',
      'Good day to spray and fertilise.',
    ]);
  });

  it('says "today" only for today', () => {
    const week = weekSignalsFromFeed(feed);
    expect(week[0].signals[0].title.en).toBe('You can spray today');
    expect(week[6].signals[0].title.en).toBe('You can spray');
    expect(week[1].signals[2].title.en).toBe('Do not apply fertiliser');
  });

  it("uses the server's farm_actions.week when present", () => {
    const serverWeek = [
      {
        date: '2026-11-12',
        actions: [
          { kind: 'spray', status: 'stop', reason: 'wind_strong' },
          { kind: 'irrigate', status: 'wait', reason: 'check_soil' },
          { kind: 'fertilise', status: 'go', reason: 'rain_unlikely' },
        ],
        tempMax: 31,
        tempMin: 22,
        rainChance: 0,
      },
    ];
    const week = weekSignalsFromFeed({ ...feed, farm_actions: { today: [], week: serverWeek } });
    expect(week).toHaveLength(1);
    expect(week[0].headline.en).toBe('Strong wind. Do not spray.');
    expect(week[0].tempMax).toBe(31);
  });

  it('matches what the server would send', () => {
    const local = weekSignalsFromFeed(feed);
    const viaServer = weekSignalsFromFeed({ ...feed, farm_actions: farmActionsFromFeed(feed) });
    expect(viaServer).toEqual(local);
  });

  it('ignores a malformed server week and computes it instead', () => {
    const week = weekSignalsFromFeed({ ...feed, farm_actions: { week: [{ date: 1 }] } });
    expect(week).toHaveLength(7);
  });

  it('words an unknown reason code from a newer server plainly', () => {
    const week = weekSignalsFromFeed({
      farm_actions: {
        week: [
          {
            date: '2026-11-12',
            actions: [
              { kind: 'spray', status: 'wait', reason: 'something_new' },
              { kind: 'irrigate', status: 'wait', reason: 'check_soil' },
              { kind: 'fertilise', status: 'go', reason: 'rain_unlikely' },
            ],
            tempMax: null,
            tempMin: null,
            rainChance: null,
          },
        ],
      },
    });
    expect(week[0].signals[0].reason.en).toBeTruthy();
    expect(week[0].headline.en).toBeTruthy();
  });

  it('returns [] when the feed has no daily data', () => {
    expect(weekSignalsFromFeed(null)).toEqual([]);
    expect(weekSignalsFromFeed({ current: feed.current })).toEqual([]);
  });

  it('every reason the engine can give has real wording', () => {
    for (const rain of [0, 30, 60]) {
      for (const wind of [5, 16, 25]) {
        for (const temp of [25, 35]) {
          for (const soil of [undefined, 0.1, 0.3, 0.4]) {
            const signals = todaySignals({
              temp,
              humidity: 60,
              windSpeed: wind,
              rainChanceToday: rain,
              rainChanceNext12h: rain,
              soilMoisture: soil,
            });
            for (const s of signals) {
              expect(['The weather is suitable.', 'Watch the weather before you start.', 'The weather is not suitable.']).not.toContain(
                s.reason.en,
              );
            }
          }
        }
      }
    }
    // A future day without wind gives the 'rain_unlikely' spray reason.
    const noWind = weekSignalsFromFeed({ daily: { time: ['2026-11-12'], precipitation_probability_max: [0] } });
    expect(noWind[0].signals[0].reason.en).toBe('Rain is unlikely.');
  });
});
