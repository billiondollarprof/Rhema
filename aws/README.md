# AWS uptime watcher

Watches every hospital from outside Cloudflare, every 5 minutes, and emails
Anthony when one stops answering and again when it is back. Request 74,
`PLAN.md` section 7. It lives in StellaXafe's AWS account, holds no patient
data, and costs nothing inside AWS's always free allowance.

## The files

| File | What it is |
|---|---|
| `uptime_watcher.py` | The watcher. Every line is explained in it. |
| `test_uptime_watcher.py` | Its tests, with pretend websites and email. Run inside `npm run verify`. |
| `sites.json` | The hospitals to watch. **Add a hospital here.** |
| `template.yaml` | Everything AWS needs, built once from this one file. |
| `target.json` | The region, the function name and the deploy role's address. |
| `../.github/workflows/aws-watcher.yml` | Puts the code in AWS and proves it works. |

## What it does

1. Every 5 minutes it opens each hospital's front page and its health check
   (`/api/health`, which answers `{"ok": true}`).
2. One failed try is ignored. It tries twice inside a run, and a hospital
   counts as down only after 2 runs in a row fail (about 10 minutes).
3. It emails once when a hospital goes down and once when it comes back.
   It never emails every run, and never repeats while a hospital stays down.
4. A separate alarm emails if the watcher itself breaks.
5. The emails go through AWS SNS, not Resend or Supabase, so they still
   arrive when the app is down.

## Setting it up (once, by Anthony)

1. Save `aws/template.yaml` to the device (Claude sends it in the chat).
2. Sign in to the StellaXafe AWS account. At the top right, set the region
   to **Europe (Ireland) eu-west-1**.
3. Search for **CloudFormation**, then **Create stack**, then **With new
   resources (standard)**.
4. Choose **Upload a template file**, choose `template.yaml`, then **Next**.
5. Stack name: `stellaxafe-uptime-watcher`. AlertEmail: the email that
   should get alerts. Leave GitHubRepo as it is. **Next**, then **Next**.
6. Tick the box that says CloudFormation might create IAM resources with
   custom names, then **Submit**.
7. Wait about 3 minutes for **CREATE_COMPLETE**. If it says ROLLBACK, open
   the **Events** tab and send Claude the first red line.
8. Open the **Outputs** tab. Copy `DeployRoleArn` and give it to Claude. It
   is an address, not a secret.
9. Open the email "AWS Notification - Subscription Confirmation" and tap
   **Confirm subscription**. Without this, no alert can reach you.

Then Claude puts the address in `target.json` and merges to `main`, and the
workflow deploys the watcher and runs it once in test mode.

## Everyday

- **A new hospital, or a hospital's new address:** edit `sites.json`, merge
  to `main`. The workflow deploys it. The name must not repeat.
- **After changing `template.yaml`:** run the workflow again (Actions, then
  "AWS uptime watcher", then Run workflow), because updating the stack puts
  the placeholder code back until the next deploy.
- **See what it is doing:** AWS console, Lambda, `stellaxafe-uptime-watcher`,
  Monitor, View CloudWatch logs. Each run prints one line per hospital.

## What it costs

Inside the always free allowance: 1 million Lambda runs a month (it uses
about 8,640), 400,000 GB-seconds of compute, 1,000 emails, DynamoDB at 1
read and 1 write a second. Past that: Lambda $0.20 per million runs, SNS
email $2 per 100,000. Never SMS, which is charged per message.
The account has a $20 spend limit and a $1 budget alarm.

## Least access, and why

- The watcher can read and write one table and publish to one topic.
- The deploy role can update, read and run one function, and only when the
  request comes from the `main` branch of `billiondollarprof/Rhema`.
- No access key or password exists anywhere. GitHub proves who it is to AWS
  each time (OIDC).
