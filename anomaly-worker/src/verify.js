import { verifyKey } from 'discord-interactions';

export async function verifyDiscordRequest(request, env) {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const body = await request.clone().arrayBuffer();

  if (!signature || !timestamp) {
    return false;
  }

  const isValidRequest = await verifyKey(
    body,
    signature,
    timestamp,
    env.DISCORD_PUBLIC_KEY
  );

  return isValidRequest;
}
