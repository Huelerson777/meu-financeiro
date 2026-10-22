/**
 * Transcrição de áudio (notas de voz do WhatsApp). A API da Anthropic não
 * aceita áudio, então usa qualquer serviço compatível com o endpoint
 * `/audio/transcriptions` da OpenAI — a Groq tem uma camada grátis:
 *   TRANSCRIPTION_API_URL=https://api.groq.com/openai/v1/audio/transcriptions
 *   TRANSCRIPTION_MODEL=whisper-large-v3-turbo
 */
const DEFAULT_URL = 'https://api.openai.com/v1/audio/transcriptions';
const DEFAULT_MODEL = 'whisper-1';

export function isTranscriptionConfigured(): boolean {
  return Boolean(process.env.TRANSCRIPTION_API_KEY);
}

/** Extensão que o serviço usa pra reconhecer o formato ("audio/ogg; codecs=opus" -> "ogg"). */
export function audioExtension(mimeType: string): string {
  const base = mimeType.split(';')[0].trim().toLowerCase();
  const map: Record<string, string> = {
    'audio/ogg': 'ogg',
    'audio/opus': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/aac': 'aac',
    'audio/amr': 'amr',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
  };
  return map[base] ?? 'ogg';
}

export async function transcribeAudio(audio: Buffer, mimeType: string): Promise<string> {
  const apiKey = process.env.TRANSCRIPTION_API_KEY;
  if (!apiKey) throw new Error('TRANSCRIPTION_API_KEY não configurada');

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(audio)], { type: mimeType }), `audio.${audioExtension(mimeType)}`);
  form.append('model', process.env.TRANSCRIPTION_MODEL || DEFAULT_MODEL);
  form.append('language', 'pt');
  form.append('response_format', 'json');

  const res = await fetch(process.env.TRANSCRIPTION_API_URL || DEFAULT_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Transcrição falhou: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { text?: string };
  return (data.text ?? '').trim();
}
