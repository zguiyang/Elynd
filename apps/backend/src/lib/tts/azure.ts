import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

import { HTTP_STATUS } from '@/constants';
import { AppError } from '@/lib/errors';

export type AzureTtsWordTiming = {
  text: string;
  audioOffsetMs: number;
  durationMs: number;
  textOffset: number;
};

export type AzureTtsSynthesizeInput = {
  subscriptionKey: string;
  region: string;
  voice: string;
  text: string;
};

export type AzureTtsSynthesizeResult = {
  audio: Buffer;
  mimeType: string;
  wordTimings: AzureTtsWordTiming[];
};

/**
 * Low-level Azure Speech SDK adapter. Callers pass credentials explicitly — no DB access.
 */
export async function synthesizeAzureTts(input: AzureTtsSynthesizeInput): Promise<AzureTtsSynthesizeResult> {
  const speechConfig = sdk.SpeechConfig.fromSubscription(input.subscriptionKey, input.region);
  speechConfig.speechSynthesisVoiceName = input.voice;
  speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;

  const synthesizer = new sdk.SpeechSynthesizer(speechConfig, undefined);
  const wordTimings: AzureTtsWordTiming[] = [];

  synthesizer.wordBoundary = (_sender, event) => {
    wordTimings.push({
      text: event.text,
      audioOffsetMs: event.audioOffset / 10_000,
      durationMs: event.duration / 10_000,
      textOffset: event.textOffset,
    });
  };

  try {
    const result = await new Promise<sdk.SpeechSynthesisResult>((resolve, reject) => {
      synthesizer.speakTextAsync(
        input.text,
        (synthesisResult) => resolve(synthesisResult),
        (error) => reject(new Error(typeof error === 'string' ? error : String(error))),
      );
    });

    if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
      return {
        audio: Buffer.from(result.audioData),
        mimeType: 'audio/mpeg',
        wordTimings,
      };
    }

    const details = sdk.CancellationDetails.fromResult(result);
    const message = details.errorDetails?.trim() || details.reason.toString() || 'TTS synthesis failed';
    throw new AppError(HTTP_STATUS.SERVICE_UNAVAILABLE, message);
  } finally {
    synthesizer.close();
  }
}
