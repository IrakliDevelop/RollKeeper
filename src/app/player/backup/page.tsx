import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Button } from '@/components/ui/forms/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/layout/card';

import { isPlayerBackupWizardVisible } from '@/lib/playerBackup/playerBackupFlags';

export default async function PlayerBackupPage() {
  if (!isPlayerBackupWizardVisible()) notFound();

  return (
    <main className="bg-surface min-h-screen px-4 py-12">
      <div className="mx-auto max-w-2xl space-y-5">
        <Button variant="ghost" asChild>
          <Link href="/player">Back to characters</Link>
        </Button>
        <Card padding="lg">
          <CardHeader>
            <CardTitle>Protect your characters</CardTitle>
            <CardDescription>
              Save a safety file, choose your characters, and protect them with
              your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-6 space-y-3">
            <h2 className="text-heading text-base font-semibold">
              Save a safety file
            </h2>
            <p className="text-body text-sm">
              The guided setup is being introduced behind this private preview.
              Viewing this page does not copy or change a character.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
