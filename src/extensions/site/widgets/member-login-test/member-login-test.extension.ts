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
  // Wix documents staticContainer, but the v2 TypeScript definitions
  // still expose the deprecated autoAdd property.
  // @ts-expect-error Documented Wix configuration not yet reflected in v2 types.
  staticContainer: "HOMEPAGE",
},

  tagName: "member-login-test",
  element: "./extensions/site/widgets/member-login-test/member-login-test.tsx",
  settings: "./extensions/site/widgets/member-login-test/member-login-test.panel.tsx",

  
});