import { audioExtension, isTranscriptionConfigured, transcribeAudio } from './transcription';

describe('audioExtension', () => {
  it('ignora parâmetros do mime e mapeia formatos comuns', () => {
    expect(audioExtension('audio/ogg; codecs=opus')).toBe('ogg');
    expect(audioExtension('audio/mpeg')).toBe('mp3');
    expect(audioExtension('audio/mp4')).toBe('m4a');
    expect(audioExtension('AUDIO/AMR')).toBe('amr');
  });

  it('cai em ogg (formato das notas de voz do WhatsApp) quando desconhecido', () => {
    expect(audioExtension('application/octet-stream')).toBe('ogg');
  });
});

describe('transcribeAudio', () => {
  const originalFetch = global.fetch;
  const env = { ...process.env };

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...env };
  });

  it('só considera configurado com TRANSCRIPTION_API_KEY', () => {
    delete process.env.TRANSCRIPTION_API_KEY;
    expect(isTranscriptionConfigured()).toBe(false);
    process.env.TRANSCRIPTION_API_KEY = 'k';
    expect(isTranscriptionConfigured()).toBe(true);
  });

  it('falha sem chave', async () => {
    delete process.env.TRANSCRIPTION_API_KEY;
    await expect(transcribeAudio(Buffer.from('a'), 'audio/ogg')).rejects.toThrow('TRANSCRIPTION_API_KEY');
  });

  it('envia o áudio ao endpoint configurado e devolve o texto sem espaços nas pontas', async () => {
    process.env.TRANSCRIPTION_API_KEY = 'chave';
    process.env.TRANSCRIPTION_API_URL = 'https://stt.exemplo/v1/audio/transcriptions';
    process.env.TRANSCRIPTION_MODEL = 'whisper-teste';
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ text: '  gastei vinte no mercado ' }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    const text = await transcribeAudio(Buffer.from('bytes'), 'audio/ogg; codecs=opus');

    expect(text).toBe('gastei vinte no mercado');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://stt.exemplo/v1/audio/transcriptions');
    expect(init.headers.Authorization).toBe('Bearer chave');
    const form = init.body as FormData;
    expect(form.get('model')).toBe('whisper-teste');
    expect(form.get('language')).toBe('pt');
    expect((form.get('file') as File).name).toBe('audio.ogg');
  });

  it('propaga erro HTTP do serviço', async () => {
    process.env.TRANSCRIPTION_API_KEY = 'chave';
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'unauthorized' }) as unknown as typeof fetch;
    await expect(transcribeAudio(Buffer.from('a'), 'audio/ogg')).rejects.toThrow('401');
  });
});
