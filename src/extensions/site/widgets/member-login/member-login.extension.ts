import { extensions } from '@wix/astro/builders';

export default extensions.customElement({
  id: '36f125a7-92b5-41d5-8883-c309952f6384',
  name: 'Member Login',
  width: {
    defaultWidth: 900,
    allowStretch: true,
  },
  height: {
    defaultHeight: 240,
  },
  installation: {
    autoAdd: false,
  },
  // Preserve the existing tag so Wix Editor placements keep their registered identity.
  tagName: 'member-login-test',
  element: './extensions/site/widgets/member-login/member-login.tsx',
  settings: './components/member/MemberLoginSettingsPanel.tsx',
  presets: [
    {
      id: '4a7e3f12-9c6b-4d81-a250-8e3b6f9c1d74',
      name: 'Member Login',
      thumbnailUrl: '{{BASE_URL}}/public/thumbnail.png',
    },
  ],
});
