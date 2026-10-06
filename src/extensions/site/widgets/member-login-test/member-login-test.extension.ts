import { extensions } from "@wix/astro/builders";

export default extensions.customElement({
  id: "36f125a7-92b5-41d5-8883-c309952f6384",
  name: "Member Login Test",
  width: {
    defaultWidth: 360,
    allowStretch: false,
  },
  height: {
    defaultHeight: 180,
  },
  installation: {
    autoAdd: true,
  },
  tagName: "member-login-test",
  element: "./extensions/site/widgets/member-login-test/member-login-test.tsx",
  settings: "./extensions/site/widgets/member-login-test/member-login-test.panel.tsx",
});
