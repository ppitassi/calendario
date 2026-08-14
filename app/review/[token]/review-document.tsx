'use client';

import { ThemeProvider } from '../../../src/components/ThemeProvider';
import { NotificationProvider } from '../../../src/contexts/NotificationContext';
import { ReviewScreen } from '../../../src/screens/ReviewScreen';
import { buildPresentationViewModel } from '../../../lib/presentation-model';

export default function ReviewDocument({ data, token, isExport }: { data: any; token: string; isExport: boolean }) {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <ReviewScreen review={data} token={token} isExport={isExport} presentationModel={buildPresentationViewModel(data)} />
      </NotificationProvider>
    </ThemeProvider>
  );
}
