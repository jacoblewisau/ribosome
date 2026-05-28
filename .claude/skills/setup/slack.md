# Slack integration options for Ribosome

The chain posts story, spec, and PR/validator reports on the Issue/PR thread by default. If you want those (or summaries of them) to also land in Slack, you have four shapes to choose from. Pick one, or compose two (the official GitHub-Slack app pairs well with any other choice).

This file is read by `.claude/skills/setup/SKILL.md` when the maintainer passes `--slack-webhook` to `npm run setup` (option (a) only). Options (b), (c), and (d) require more setup than the orchestrator can do programmatically; the snippets here are copy-paste-ready for the operator to run themselves.

---

## Comparison

| Shape | Setup time | Buttons / slash | Pretty thread | Cost | Best for |
|---|---|---|---|---|---|
| (a) Incoming webhook | ~5 min | no | basic | free | "just notify me" |
| (b) Slack app with bot token | ~15 min | yes (incl. `/approve` from Slack) | yes | free until distribution | full chain remote-control |
| (c) Workflow Builder | ~10 min | limited buttons | basic | free | no-code teams |
| (d) Official GitHub-Slack app | ~3 min | comments on Issues/PRs | yes | free | ambient awareness (complementary) |

**Recommended primary**: (a) for first-timers, (d) layered for ambient signal. Upgrade to (b) when you want to `/approve` from Slack without opening GitHub.

---

## (a) Incoming webhook — 5 minutes

Best for: notifications only. One-way. No buttons or slash commands. The channel is fixed at install time.

### Setup

1. Open `https://api.slack.com/apps` and click **Create New App** -> **From scratch**. Name it (e.g. "Ribosome") and pick your workspace.
2. In the left sidebar: **Incoming Webhooks** -> toggle on -> **Add New Webhook to Workspace** -> pick the channel.
3. Copy the URL: `https://hooks.slack.com/services/T.../B.../X...`. Treat it as a secret.
4. Set it as a repo secret:

```bash
echo "<webhook-url>" | gh secret set SLACK_WEBHOOK_URL --repo <owner>/<repo>
```

### Post a message from a workflow

Drop this into a workflow step that wants to notify Slack:

```yaml
- name: Notify Slack
  if: always()
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
  run: |
    curl -sS -X POST -H 'Content-type: application/json' \
      --data '{"text":"Chain ${{ github.run_id }} status: ${{ job.status }}"}' \
      "$SLACK_WEBHOOK_URL"
```

### Minimal payload

```json
{ "text": "Chain 0005 ready for gate-1 review. https://github.com/.../issues/1" }
```

Rate limit: Slack does not publish a hard number; typically forgiving for a per-chain post. Don't loop in a tight burst.

---

## (b) Slack app with bot token — ~15 minutes

Best for: two-way control. The bot can post rich messages **and** receive slash commands (`/approve` from Slack), supports threaded replies, can react to events.

### Setup outline

1. Same app-create flow as (a).
2. **OAuth & Permissions** -> add Bot Token Scopes: at minimum `chat:write` (post messages). For slash commands also add `commands`.
3. **Install App** -> install to workspace -> copy the **Bot User OAuth Token** (`xoxb-...`).
4. Set as a repo secret:

```bash
echo "<xoxb-token>" | gh secret set SLACK_BOT_TOKEN --repo <owner>/<repo>
echo "<channel-id>" | gh secret set SLACK_CHANNEL_ID --repo <owner>/<repo>
```

### Post a message from a workflow

```yaml
- name: Slack post
  env:
    SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
    SLACK_CHANNEL_ID: ${{ secrets.SLACK_CHANNEL_ID }}
  run: |
    curl -sS -X POST https://slack.com/api/chat.postMessage \
      -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
      -H 'Content-type: application/json; charset=utf-8' \
      --data "{\"channel\":\"$SLACK_CHANNEL_ID\",\"text\":\"Chain ${{ github.run_id }} merged: ${{ github.event.pull_request.html_url }}\"}"
```

### Slash command back to GitHub

Out of scope for the orchestrator; requires a public HTTPS endpoint that translates `/approve` -> `gh issue comment`. See `https://docs.slack.dev/interactivity/slash-commands` and pair with a Cloudflare Worker or similar.

---

## (c) Workflow Builder — ~10 minutes

Best for: no-code teams that want richer formatting than (a) but do not want to manage tokens.

### Setup outline

1. In Slack: **Tools** -> **Workflow Builder** -> **Create Workflow**.
2. Pick **Webhook** as the trigger. Slack generates a URL.
3. Add a step: **Send Message**. Reference webhook variables in the message body.
4. **Publish**. Copy the webhook URL into `SLACK_WEBHOOK_URL` (same secret name as (a)).

### Notes

- Workflow Builder webhook URLs are scoped to the workflow's defined input variables. The orchestrator's POST shape must match what the workflow expects.
- The workflow can post to channels, send DMs, or fan out to multiple channels. (a) cannot.
- Limited support for rich block formatting; pretty messages still need (b).

---

## (d) Official GitHub-Slack app — ~3 minutes (complementary)

Best for: ambient awareness. Subscribes a Slack channel to a repo's events (Issue and PR open/close/reopen, releases, Actions runs). Not Ribosome-aware, so the bot's posts are generic. Useful in addition to (a) or (b), not instead of.

### Setup

1. Install at `https://github.com/integrations/slack`.
2. In the Slack channel: `/invite @github`.
3. Subscribe the channel to the repo:

```
/github subscribe <owner>/<repo>
```

To add review/comment events:

```
/github subscribe <owner>/<repo> reviews comments
```

That is the entire flow. Nothing to wire into `.github/workflows/`.

---

## When to pick which

- **You just want a ping when something merges.** -> (a) or (d).
- **You want to read full validator reports without opening GitHub.** -> (b) with `chat.postMessage` and rich blocks.
- **You want to `/approve` from Slack.** -> (b) with a slash-command handler. Plan a small HTTPS endpoint.
- **You have a Slack admin and zero coding bandwidth.** -> (c) (workflow builder) for a one-time setup.
- **You want all of the above.** -> (a) + (d), and add (b) when you outgrow them.

## What the orchestrator does

When `npm run setup -- --slack-webhook URL` is passed:

1. Validates the URL format (`https://hooks.slack.com/services/...`).
2. Sets it as the repo secret `SLACK_WEBHOOK_URL`.
3. That is all. The maintainer is responsible for wiring the workflow step in `ribosome.yml` or a sibling workflow to actually call the webhook. See option (a)'s "Post a message from a workflow" snippet.

The orchestrator does **not** automate (b), (c), or (d). Those require token issuance via OAuth, workflow-builder UI clicks, or browser-app install respectively; all are out of scope for one-shot programmatic bootstrap.
