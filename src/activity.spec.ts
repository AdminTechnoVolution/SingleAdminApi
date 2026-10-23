import { activityMatch, activityStages } from './activity';

describe('estimated activity aggregation', () => {
  const now = new Date('2026-07-26T12:00:00.000Z');

  it('filters activity only within the last 30 days', () => {
    expect(activityMatch('30d', now)).toEqual({
      lastInteractionAt: { $gte: new Date('2026-06-26T12:00:00.000Z') },
    });
    expect(activityMatch('7d', now)).toBeNull();
    expect(activityMatch('90d', now)).toBeNull();
    expect(activityMatch('inactive', now)).toBeNull();
    expect(activityMatch(undefined, now)).toBeNull();
  });

  it('contains only read aggregation stages', () => {
    const serialized = JSON.stringify(activityStages());
    for (const writeOperator of ['$merge', '$out', '$setField', '$replaceWith']) {
      expect(serialized).not.toContain(`"${writeOperator}"`);
    }
    expect(serialized).toContain('"$lookup"');
    expect(serialized).toContain('"isEstimated"');
  });
});
