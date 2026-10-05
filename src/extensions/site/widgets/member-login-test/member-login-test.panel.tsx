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
            Test widget for Wix site-member authentication. The live site
            opens Wix's native member login flow.
          </Text>
        </SidePanel.Content>
      </SidePanel>
    </WixDesignSystemProvider>
  );
};

export default MemberLoginTestPanel;
