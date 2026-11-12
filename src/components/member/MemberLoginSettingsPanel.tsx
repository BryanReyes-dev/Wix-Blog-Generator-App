import type { FC } from 'react';
import {
  SidePanel,
  Text,
  WixDesignSystemProvider,
} from '@wix/design-system';
import '@wix/design-system/styles.global.css';

const MemberLoginSettingsPanel: FC = () => {
  return (
    <WixDesignSystemProvider>
      <SidePanel width="300" height="100vh">
        <SidePanel.Content>
          <Text>
            Member sign-in and workflow access. The live site uses Wix member authentication and checks approval before showing the blog-generation workflow.
          </Text>
        </SidePanel.Content>
      </SidePanel>
    </WixDesignSystemProvider>
  );
};

export default MemberLoginSettingsPanel;
