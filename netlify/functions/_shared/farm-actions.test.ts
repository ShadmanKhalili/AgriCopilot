import { describe, expect, it } from 'vitest';
import {
  ACTION_REASONS,
  FARM_THRESHOLDS,
  farmActions,
  farmActionsFromFeed,
  fertiliseAction,
  irrigateAction,
  isSafeSprayHour,
  sprayAction,
  todayConditionsFromFeed,
  weekActionsFromFeed,
  type ActionInput,
} from './farm-actions';

const calm: ActionInput = { temp: 26, windSpeed: 6, rainChance: 5, rainChanceSoon: 5, humidity: 60 };

describe('thresholds', () => {
  it('keeps the agreed numbers', () => {
    expect(FARM_THRESHOLDS).toEqual({
      RAIN_LIKELY: 50,
      RAIN_POSSIBLE: 25,
      WIND_TOO_STRONG: 20,
      WIND_BREEZY: 14,
      TOO_HOT_TO_SPRAY: 33,
      SOIL_WET: 0.35,
      SOIL_DRY: 0.22,
    });
  });
});

describe('sprayAction', () => {
  it('goes in calm dry weather', () => {
    expect(sprayAction(calm)).toEqual({ kind: 'spray', status: 'go', reason: 'low_risk' });
  });

  it('stops at the rain-likely line, today or in the next hours', () => {
    expect(sprayAction({ ...calm, rainChance: 50 })).toMatchObject({ status: 'stop', reason: 'rain_likely' });
    expect(sprayAction({ ...calm, rainChanceSoon: 70 })).toMatchObject({ status: 'stop', reason: 'rain_likely' });
    expect(sprayAction({ ...calm, rainChance: 49 }).status).toBe('wait');
  });

  it('stops above 20 km/h wind, not at it', () => {
    expect(sprayAction({ ...calm, windSpeed: 21 })).toMatchObject({ status: 'stop', reason: 'wind_strong' });
    expect(sprayAction({ ...calm, windSpeed: 20 })).toMatchObject({ status: 'wait', reason: 'wind_breezy' });
  });

  it('puts rain ahead of wind when both are bad', () => {
    expect(sprayAction({ ...calm, rainChance: 80, windSpeed: 30 }).reason).toBe('rain_likely');
  });

  it('waits for a calm, cool time; the first matching reason wins', () => {
    expect(sprayAction({ ...calm, rainChance: 25 }).reason).toBe('rain_possible');
    expect(sprayAction({ ...calm, rainChance: 24 }).status).toBe('go');
    expect(sprayAction({ ...calm, windSpeed: 15 }).reason).toBe('wind_breezy');
    expect(sprayAction({ ...calm, windSpeed: 14 }).status).toBe('go');
    expect(sprayAction({ ...calm, temp: 34 }).reason).toBe('too_hot');
    expect(sprayAction({ ...calm, temp: 33 }).status).toBe('go');
    expect(sprayAction({ ...calm, rainChance: 30, windSpeed: 16, temp: 35 }).reason).toBe('rain_possible');
    expect(sprayAction({ ...calm, windSpeed: 16, temp: 35 }).reason).toBe('wind_breezy');
  });

  it('decides from rain and heat only when the wind is unknown', () => {
    const noWind: ActionInput = { temp: 26, rainChance: 5 };
    expect(sprayAction(noWind)).toEqual({ kind: 'spray', status: 'go', reason: 'rain_unlikely' });
    expect(sprayAction({ ...noWind, temp: 35 }).reason).toBe('too_hot');
    expect(sprayAction({ ...noWind, rainChance: 60 }).reason).toBe('rain_likely');
  });

  it('skips the heat check when the temperature is unknown', () => {
    expect(sprayAction({ windSpeed: 5, rainChance: 0 }).status).toBe('go');
  });
});

describe('irrigateAction', () => {
  it('stops when rain is likely, even on dry soil', () => {
    expect(irrigateAction({ ...calm, rainChance: 60 })).toMatchObject({ status: 'stop', reason: 'rain_likely' });
    expect(irrigateAction({ ...calm, soilMoisture: 0.2, rainChanceSoon: 80 }).reason).toBe('rain_likely');
  });

  it('follows the soil reading', () => {
    expect(irrigateAction({ ...calm, soilMoisture: 0.35 })).toMatchObject({ status: 'stop', reason: 'soil_wet' });
    expect(irrigateAction({ ...calm, soilMoisture: 0.21 })).toMatchObject({ status: 'go', reason: 'soil_dry' });
    expect(irrigateAction({ ...calm, soilMoisture: 0.22 })).toMatchObject({ status: 'wait', reason: 'check_soil' });
  });

  it('asks to check the soil without a reading', () => {
    expect(irrigateAction(calm)).toMatchObject({ status: 'wait', reason: 'check_soil' });
    expect(irrigateAction({ ...calm, rainChance: 40 })).toMatchObject({ status: 'wait', reason: 'check_soil' });
  });
});

describe('fertiliseAction', () => {
  it('follows the chance of rain', () => {
    expect(fertiliseAction(calm)).toMatchObject({ status: 'go', reason: 'rain_unlikely' });
    expect(fertiliseAction({ ...calm, rainChance: 25 })).toMatchObject({ status: 'wait', reason: 'rain_possible' });
    expect(fertiliseAction({ ...calm, rainChanceSoon: 50 })).toMatchObject({ status: 'stop', reason: 'rain_likely' });
  });

  it('ignores wind and heat', () => {
    expect(fertiliseAction({ ...calm, windSpeed: 40, temp: 40 }).status).toBe('go');
  });
});

describe('farmActions', () => {
  it('returns spray, irrigate, fertilise in that order', () => {
    expect(farmActions(calm).map((a) => a.kind)).toEqual(['spray', 'irrigate', 'fertilise']);
  });

  it('gives the same answer for the same input', () => {
    expect(farmActions({ ...calm, windSpeed: 17 })).toEqual(farmActions({ ...calm, windSpeed: 17 }));
  });

  it('only uses listed reason codes', () => {
    const inputs: ActionInput[] = [];
    for (const rainChance of [0, 25, 50, 90]) {
      for (const windSpeed of [undefined, 5, 15, 25]) {
        for (const temp of [undefined, 20, 35]) {
          for (const soilMoisture of [undefined, 0.1, 0.3, 0.4]) {
            inputs.push({ rainChance, windSpeed, temp, soilMoisture });
          }
        }
      }
    }
    for (const input of inputs) {
      for (const a of farmActions(input)) expect(ACTION_REASONS).toContain(a.reason);
    }
  });
});

const feed = {
  current: { time: '2026-11-12T10:00', temperature_2m: 27.4, relative_humidity_2m: 71, wind_speed_10m: 9 },
  hourly: {
    time: ['2026-11-12T08:00', '2026-11-12T09:00', '2026-11-12T10:00', '2026-11-12T11:00', '2026-11-12T12:00'],
    precipitation_probability: [90, 90, 10, 20, 15],
  },
  daily: {
    time: [
      '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19',
    ],
    precipitation_probability_max: [10, 70, 30, 5, 5, 5, 5, 5],
    temperature_2m_max: [29, 28, 30, 35, 30, 29, 28, 27],
    temperature_2m_min: [20, 21, 22, 23, 22, 21, 20, 19],
    wind_speed_10m_max: [30, 10, 10, 10, 25, 16, 10, 10],
  },
  agro_metrics: { soil_moisture_0_7cm: 0.2 },
};

describe('todayConditionsFromFeed', () => {
  it('reads current numbers and only the hours from now on', () => {
    expect(todayConditionsFromFeed(feed)).toEqual({
      temp: 27.4,
      humidity: 71,
      windSpeed: 9,
      rainChanceToday: 20, // the rest of today, from the hourly data
      rainChanceNext12h: 20,
      soilMoisture: 0.2,
    });
  });

  it('returns null without a current temperature', () => {
    expect(todayConditionsFromFeed(undefined)).toBeNull();
    expect(todayConditionsFromFeed({ current: { temperature_2m: 'hot' } })).toBeNull();
  });

  it('fills missing current numbers with 0 and missing hourly with the daily chance', () => {
    expect(todayConditionsFromFeed({ current: { temperature_2m: 25 }, daily: { precipitation_probability_max: [35] } })).toEqual({
      temp: 25,
      humidity: 0,
      windSpeed: 0,
      rainChanceToday: 35,
      rainChanceNext12h: 35,
      soilMoisture: undefined,
    });
  });
});

describe('weekActionsFromFeed', () => {
  const week = weekActionsFromFeed(feed);
  const statuses = (i: number) => week[i].actions.map((a) => `${a.status}:${a.reason}`);

  it('covers 7 days starting today', () => {
    expect(week.map((d) => d.date)).toEqual([
      '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18',
    ]);
    expect(week[0]).toMatchObject({ tempMax: 29, tempMin: 20, rainChance: 10 });
  });

  it("uses today's full reading for day 0 (current wind and soil, not the daily max)", () => {
    // Daily max wind is 30, but the current wind is 9; soil 0.2 is dry.
    expect(statuses(0)).toEqual(['go:low_risk', 'go:soil_dry', 'go:rain_unlikely']);
    expect(week[0].actions).toEqual(farmActionsFromFeed(feed)!.today);
  });

  it("uses each later day's rain, max temperature and max wind", () => {
    expect(statuses(1)).toEqual(['stop:rain_likely', 'stop:rain_likely', 'stop:rain_likely']);
    expect(statuses(2)).toEqual(['wait:rain_possible', 'wait:check_soil', 'wait:rain_possible']);
    expect(statuses(3)).toEqual(['wait:too_hot', 'wait:check_soil', 'go:rain_unlikely']);
    expect(statuses(4)).toEqual(['stop:wind_strong', 'wait:check_soil', 'go:rain_unlikely']);
    expect(statuses(5)).toEqual(['wait:wind_breezy', 'wait:check_soil', 'go:rain_unlikely']);
    expect(statuses(6)).toEqual(['go:low_risk', 'wait:check_soil', 'go:rain_unlikely']);
  });

  it('never invents a wind value for a day without one', () => {
    const noWind = { ...feed, daily: { ...feed.daily, wind_speed_10m_max: undefined } };
    const w = weekActionsFromFeed(noWind);
    expect(w[4].actions[0]).toEqual({ kind: 'spray', status: 'go', reason: 'rain_unlikely' });
    expect(w[3].actions[0].reason).toBe('too_hot');
  });

  it('uses null for missing temperatures and skips the heat check', () => {
    const noTemps = { daily: { time: ['2026-11-12', '2026-11-13'], precipitation_probability_max: [0, 0] } };
    const w = weekActionsFromFeed(noTemps);
    expect(w).toHaveLength(2);
    expect(w[1]).toMatchObject({ tempMax: null, tempMin: null, rainChance: 0 });
    expect(w[1].actions[0]).toMatchObject({ status: 'go', reason: 'rain_unlikely' });
  });

  it('leaves out a later day that has no rain chance', () => {
    const gap = { daily: { time: ['2026-11-12', '2026-11-13', '2026-11-14'], precipitation_probability_max: [10, null, 60] } };
    expect(weekActionsFromFeed(gap).map((d) => d.date)).toEqual(['2026-11-12', '2026-11-14']);
  });

  it('works without a current reading, deciding day 0 from the daily numbers', () => {
    const w = weekActionsFromFeed({ daily: feed.daily });
    expect(w[0].actions[0]).toMatchObject({ status: 'stop', reason: 'wind_strong' });
    expect(w[0].actions[1].reason).toBe('check_soil');
  });

  it('keeps day 0 when today has no daily rain chance but a current reading', () => {
    const w = weekActionsFromFeed({ current: feed.current, daily: { time: ['2026-11-12'] } });
    expect(w).toHaveLength(1);
    expect(w[0].rainChance).toBeNull();
  });

  it('returns [] without daily dates', () => {
    expect(weekActionsFromFeed(null)).toEqual([]);
    expect(weekActionsFromFeed({ current: feed.current })).toEqual([]);
    expect(weekActionsFromFeed({ daily: { precipitation_probability_max: [10] } })).toEqual([]);
  });

  it('trims a date-time to the date', () => {
    expect(weekActionsFromFeed({ daily: { time: ['2026-11-12T00:00'], precipitation_probability_max: [0] } })[0].date).toBe(
      '2026-11-12',
    );
  });
});

describe('farmActionsFromFeed', () => {
  it('returns today and the week', () => {
    const r = farmActionsFromFeed(feed)!;
    expect(r.today.map((a) => a.kind)).toEqual(['spray', 'irrigate', 'fertilise']);
    expect(r.week).toHaveLength(7);
  });

  it('returns null without a current reading', () => {
    expect(farmActionsFromFeed({ daily: feed.daily })).toBeNull();
    expect(farmActionsFromFeed('nonsense')).toBeNull();
  });

  it('survives JSON round trip (as sent to the phone)', () => {
    const r = farmActionsFromFeed(feed);
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  });
});

describe('isSafeSprayHour', () => {
  it('agrees with the spray rule', () => {
    expect(isSafeSprayHour({ temp: 26, windSpeed: 6, rainChance: 5 })).toBe(true);
    expect(isSafeSprayHour({ temp: 26, windSpeed: 6, rainChance: 25 })).toBe(false);
    expect(isSafeSprayHour({ temp: 26, windSpeed: 15, rainChance: 5 })).toBe(false);
    expect(isSafeSprayHour({ temp: 34, windSpeed: 6, rainChance: 5 })).toBe(false);
  });
  it('allows up to the shared limits (rain 24, wind 14, 33 C)', () => {
    expect(isSafeSprayHour({ temp: 33, windSpeed: 14, rainChance: 24 })).toBe(true);
  });
  it('is not safe when too cold', () => {
    expect(isSafeSprayHour({ temp: 11.9, windSpeed: 3, rainChance: 0 })).toBe(false);
    expect(isSafeSprayHour({ temp: 12, windSpeed: 3, rainChance: 0 })).toBe(true);
  });
});
