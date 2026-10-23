import { PipelineStage } from 'mongoose';

type ActivitySource =
  | 'registration'
  | 'like'
  | 'dislike'
  | 'message'
  | 'report'
  | 'match'
  | 'subscription';

const sources: Array<{ source: ActivitySource; field: string; dateField: string }> = [
  { source: 'like', field: 'lastLike', dateField: 'created_at' },
  { source: 'dislike', field: 'lastDislike', dateField: 'created_at' },
  { source: 'message', field: 'lastMessage', dateField: 'created_at' },
  { source: 'report', field: 'lastReport', dateField: 'createdAt' },
  { source: 'match', field: 'lastMatch', dateField: 'updated_at' },
  { source: 'subscription', field: 'lastSubscription', dateField: 'updated_at' },
];

const latestLookup = (
  from: string,
  foreignUserField: string,
  dateField: string,
  as: string,
): PipelineStage => ({
  $lookup: {
    from,
    let: { userId: '$_id' },
    pipeline: [
      { $match: { $expr: { $eq: [`$${foreignUserField}`, '$$userId'] } } },
      { $sort: { [dateField]: -1 } },
      { $limit: 1 },
      { $project: { _id: 0, [dateField]: 1 } },
    ],
    as,
  },
});

export function activityStages(): PipelineStage[] {
  const epoch = new Date(0);
  const dateExpressions = sources.map(({ field, dateField }) => ({
    $ifNull: [{ $arrayElemAt: [`$${field}.${dateField}`, 0] }, epoch],
  }));

  return [
    latestLookup('likes', 'fromUserId', 'created_at', 'lastLike'),
    latestLookup('dislikes', 'fromUserId', 'created_at', 'lastDislike'),
    latestLookup('conversations', 'sender', 'created_at', 'lastMessage'),
    latestLookup('reports', 'reporterUserId', 'createdAt', 'lastReport'),
    latestLookup('matches', 'lastUpdatedBy', 'updated_at', 'lastMatch'),
    latestLookup('subscriptions', 'userId', 'updated_at', 'lastSubscription'),
    {
      $set: {
        lastInteractionAt: {
          $max: [{ $ifNull: ['$created_at', epoch] }, ...dateExpressions],
        },
      },
    },
    {
      $set: {
        lastInteractionSource: {
          $switch: {
            branches: sources.map(({ source, field, dateField }) => ({
              case: {
                $eq: [
                  { $ifNull: [{ $arrayElemAt: [`$${field}.${dateField}`, 0] }, epoch] },
                  '$lastInteractionAt',
                ],
              },
              then: source,
            })),
            default: 'registration',
          },
        },
        isEstimated: { $literal: true },
      },
    },
    { $unset: sources.map(({ field }) => field) },
  ];
}

export function activityMatch(activity?: string, now = new Date()): Record<string, unknown> | null {
  if (activity !== '30d') return null;
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { lastInteractionAt: { $gte: thirtyDaysAgo } };
}
