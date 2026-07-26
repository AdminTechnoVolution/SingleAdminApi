import { activityMatch, activityStages } from './activity';

describe('estimated activity aggregation', () => {
  const now = new Date('2026-07-26T12:00:00.000Z');

  it('creates cumulative activity windows', () => {
    expect(activityMatch('7d', now)).toEqual({
      lastInteractionAt: { $gte: new Date('2026-07-19T12:00:00.000Z') },
    });
    expect(activityMatch('30d', now)).toEqual({
      lastInteractionAt: { $gte: new Date('2026-06-26T12:00:00.000Z') },
    });
    expect(activityMatch('90d', now)).toEqual({
      lastInteractionAt: { $gte: new Date('2026-04-27T12:00:00.000Z') },
    });
  });

  it('keeps users without a usable date out of inactive users', () => {
    expect(activityMatch('inactive', now)).toEqual({
      lastInteractionAt: {
        $gt: new Date(0),
        $lt: new Date('2026-04-27T12:00:00.000Z'),
      },
    });
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
