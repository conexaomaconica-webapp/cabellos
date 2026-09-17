import { getMessageTemplatesAction } from '../actions';
import { MessageTemplatesClient } from '@/components/settings/MessageTemplatesClient';

export default async function MensagensSettingsPage() {
  const { data: templates } = await getMessageTemplatesAction();

  return <MessageTemplatesClient templates={templates || []} />;
}
