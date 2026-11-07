import type { FC } from "react";
import {
  SidePanel,
  Text,
  WixDesignSystemProvider,
} from "@wix/design-system";
import "@wix/design-system/styles.global.css";

const MemberLoginTestPanel: FC = () => {
  return (
    <WixDesignSystemProvider>
      <SidePanel width="300" height="100vh">
        <SidePanel.Content>
          <Text>
            Provides Wix site-member sign-in and routes approved members to the blog workflow.
          </Text>
        </SidePanel.Content>
      </SidePanel>
    </WixDesignSystemProvider>
  );
};

export default MemberLoginTestPanel;
