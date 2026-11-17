/*
 * worker/src/backup-timer.ts: starts the live backup every 2 hours, on time.
 *
 * Why: request 218d (2026-11-16). GitHub starts scheduled jobs hours late,
 * or not at all: the 01:17 backup ran at about 08:00, and none of the
 * 2-hourly runs started in their first 9 hours. Cloudflare's timer (a Cron
 * Trigger, free) runs on time, so the live Worker asks GitHub to start the
 * backup (backup.yml) at 17 minutes past every odd hour, UTC.
 *
 * The key (GITHUB_BACKUP_TOKEN, a Cloudflare secret on the main hospital
 * account) can only start and read jobs on the Rhema repository. Until it is
 * set, the timer says so in the Worker's log and does nothing else.
 *
 * GitHub's own schedule stays in backup.yml as a second chance; a run that
 * starts while another is going waits its turn (one backup at a time).
 *
 * Never: send anything but "start the backup"; run on the testing Worker
 * (wrangler.jsonc gives testing no timer).
 */

export interface BackupTimerEnv {
  GITHUB_BACKUP_TOKEN?: string
}

const WORKFLOW_URL =
  'https://api.github.com/repos/billiondollarprof/Rhema/actions/workflows/backup.yml/dispatches'

// ===== 1. Ask GitHub to start the backup =====
// night: the 01:17 UTC run (02:17 in Lagos), which also keeps the nightly
// copy and does the night's housekeeping. Returns what happened, for the log.
export async function startBackup(
  env: BackupTimerEnv,
  when: Date,
  send: typeof fetch = fetch,
): Promise<string> {
  if (!env.GITHUB_BACKUP_TOKEN) return 'Backup timer: GITHUB_BACKUP_TOKEN is not set, nothing sent.'
  const night = when.getUTCHours() === 1
  const response = await send(WORKFLOW_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_BACKUP_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'rhema-backup-timer',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref: 'main', inputs: { night: night ? 'true' : 'false' } }),
  })
  // 204 is GitHub's "started". Anything else goes in the log, without the key.
  if (response.status === 204) return `Backup timer: started (${night ? 'night' : '2-hourly'} run).`
  return `Backup timer: GitHub answered ${response.status}, the backup did not start.`
}
