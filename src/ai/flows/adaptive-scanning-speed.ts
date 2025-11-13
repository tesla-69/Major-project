'use server';

/**
 * @fileOverview Adjusts the grid scanning speed dynamically based on user blink accuracy and response times.
 *
 * - getAdjustedScanningSpeed - A function that returns an adjusted scanning speed.
 * - AdaptiveScanningSpeedInput - The input type for the getAdjustedScanningSpeed function.
 * - AdaptiveScanningSpeedOutput - The return type for the getAdjustedScanningSpeed function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AdaptiveScanningSpeedInputSchema = z.object({
  previousAccuracy: z
    .number()
    .describe('The accuracy of the user in previous rounds (0 to 1).'),
  previousResponseTime: z
    .number()
    .describe('The average response time of the user in previous rounds in milliseconds.'),
});
export type AdaptiveScanningSpeedInput = z.infer<
  typeof AdaptiveScanningSpeedInputSchema
>;

const AdaptiveScanningSpeedOutputSchema = z.object({
  adjustedScanningSpeed: z
    .number()
    .describe(
      'The adjusted scanning speed in milliseconds, optimized for the user.'
    ),
});
export type AdaptiveScanningSpeedOutput = z.infer<
  typeof AdaptiveScanningSpeedOutputSchema
>;

export async function getAdjustedScanningSpeed(
  input: AdaptiveScanningSpeedInput
): Promise<AdaptiveScanningSpeedOutput> {
  return adaptiveScanningSpeedFlow(input);
}

const prompt = ai.definePrompt({
  name: 'adaptiveScanningSpeedPrompt',
  input: {schema: AdaptiveScanningSpeedInputSchema},
  output: {schema: AdaptiveScanningSpeedOutputSchema},
  prompt: `You are an AI assistant that optimizes the scanning speed of a character grid for users with visual impairments.

  Given the user's previous accuracy (0 to 1) and average response time (in milliseconds), determine the optimal scanning speed (in milliseconds) for the next round.

  Here are the user's stats:
  Previous Accuracy: {{previousAccuracy}}
  Previous Response Time: {{previousResponseTime}} ms

  Adjust the scanning speed to help the user improve their accuracy and reduce their response time.

  Consider these factors:
  - If the accuracy is high and the response time is low, slightly increase the scanning speed.
  - If the accuracy is low and the response time is high, significantly decrease the scanning speed.
  - If the accuracy is high and the response time is high, maintain the scanning speed or slightly decrease it.
  - If the accuracy is low and the response time is low, significantly decrease the scanning speed.

  Return only a JSON object with the adjustedScanningSpeed.
  `,
});

const adaptiveScanningSpeedFlow = ai.defineFlow(
  {
    name: 'adaptiveScanningSpeedFlow',
    inputSchema: AdaptiveScanningSpeedInputSchema,
    outputSchema: AdaptiveScanningSpeedOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
