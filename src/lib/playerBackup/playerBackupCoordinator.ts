import type { PlayerBackupCloudPreview } from './playerBackupCloudPreview';
import { PlayerBackupCloudPreviewController } from './playerBackupCloudPreview';
import {
  type PlayerBackupRunV1,
  readActivePlayerBackupRun,
} from './playerBackupRunRepository';

/** Read-only foundation controller. Mutation orchestration begins in Task 5. */
export class PlayerBackupReadOnlyCoordinator {
  readonly cloud = new PlayerBackupCloudPreviewController();
  private accountId: string | null = null;
  private run: PlayerBackupRunV1 | null = null;

  changeAccount(accountId: string | null): void {
    this.accountId = accountId;
    this.run = null;
    this.cloud.changeAccount(accountId);
  }

  snapshot() {
    return {
      accountId: this.accountId,
      run: this.run,
      cloud: this.cloud.snapshot(),
    };
  }

  async discoverRun(
    factory?: IDBFactory | null
  ): Promise<PlayerBackupRunV1 | null> {
    const accountId = this.accountId;
    if (!accountId) return null;
    const run = await readActivePlayerBackupRun({ accountId, factory });
    if (this.accountId === accountId) this.run = run;
    return this.accountId === accountId ? run : null;
  }

  loadCloud(
    accountId: string,
    loader: () => Promise<PlayerBackupCloudPreview>
  ): Promise<boolean> {
    if (this.accountId !== accountId) this.changeAccount(accountId);
    return this.cloud.load(accountId, loader);
  }
}
