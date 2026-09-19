import { getSystemBrandingAction } from '@/lib/master/system-assets';
import LoginClientView from './LoginClientView';

export const revalidate = 0;

export default async function LoginPage() {
  const systemBranding = await getSystemBrandingAction();

  return <LoginClientView systemBranding={systemBranding} />;
}
