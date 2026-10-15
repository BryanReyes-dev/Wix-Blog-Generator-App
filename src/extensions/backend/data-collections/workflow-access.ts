export const collectionIdSuffix = 'WorkflowAccess';

export default {
  idSuffix: collectionIdSuffix,
  displayName: 'AI Blog Generator Workflow Access',
  fields: [
    { type: 'TEXT' as const, displayName: 'Member ID', key: 'memberId' },
    { type: 'TEXT' as const, displayName: 'Granted By', key: 'grantedBy' },
    { type: 'TEXT' as const, displayName: 'Granted At', key: 'grantedAt' },
  ],
  displayField: 'memberId',
  dataPermissions: {
    itemInsert: 'CMS_EDITOR',
    itemRead: 'CMS_EDITOR',
    itemRemove: 'CMS_EDITOR',
    itemUpdate: 'CMS_EDITOR',
  } as const,
  indexes: [],
  initialData: [],
};
