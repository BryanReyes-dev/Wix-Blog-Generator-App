import { app } from '@wix/astro/builders';
import memberLoginTest from './extensions/site/widgets/member-login-test/member-login-test.extension.ts';
import aiBlogGenerator from './extensions/dashboard/pages/ai-blog-generator/ai-blog-generator.extension.ts';

export default app()
  .use(memberLoginTest)
  .use(aiBlogGenerator);
