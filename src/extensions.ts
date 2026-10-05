import { app } from '@wix/astro/builders';
import myPage from './extensions/dashboard/pages/my-page/my-page.extension.ts';
import memberLoginTest from './extensions/site/widgets/member-login-test/member-login-test.extension.ts';

export default app()
  .use(myPage)
  .use(memberLoginTest)
