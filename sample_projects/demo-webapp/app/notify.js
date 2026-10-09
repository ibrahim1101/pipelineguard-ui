// FAKE token for PipelineGuard demo purposes only.
const slackToken = "xoxb-000000000000-FAKEFAKEFAKE";

export function notify(message) {
  return fetch("https://slack.example.invalid/api", { method: "POST", body: message, headers: { Authorization: slackToken } });
}
