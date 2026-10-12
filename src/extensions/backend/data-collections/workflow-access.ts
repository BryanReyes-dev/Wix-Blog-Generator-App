export const collectionIdSuffix = 'WorkflowAccess';

export default {
  idSuffix: collectionIdSuffix,
  displayName: 'AI Blog Generator Workflow Access',
  fields: [
    { type: 'TEXT', displayName: 'Member ID', key: 'memberId' },
    { type: 'TEXT', displayName: 'Granted By', key: 'grantedBy' },
    { type: 'TEXT', displayName: 'Granted At', key: 'grantedAt' },
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
