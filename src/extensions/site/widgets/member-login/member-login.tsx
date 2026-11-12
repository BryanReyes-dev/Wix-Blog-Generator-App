import { createRoot, type Root } from 'react-dom/client';
import { MemberAccessWidget } from '../../../../components/member/MemberAccessWidget';

class MemberLoginElement extends HTMLElement {
  private reactRoot: Root | null = null;

  connectedCallback() {
    if (this.reactRoot) return;

    this.reactRoot = createRoot(this);
    this.reactRoot.render(<MemberAccessWidget />);
  }

  disconnectedCallback() {
    this.reactRoot?.unmount();
    this.reactRoot = null;
  }
}

export default MemberLoginElement;
