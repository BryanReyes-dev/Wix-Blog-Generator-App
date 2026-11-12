import { app } from '@wix/astro/builders';
import memberLogin from './extensions/site/widgets/member-login/member-login.extension.ts';
import aiBlogGenerator from './extensions/dashboard/pages/ai-blog-generator/ai-blog-generator.extension.ts';
import workflowDataCollections from './extensions/backend/data-collections/data-collections.extension.ts';

export default app()
  .use(memberLogin)
  .use(aiBlogGenerator)
  .use(workflowDataCollections);
