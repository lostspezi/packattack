/**
 * Deterministic seeded shuffle for answer options.
 * Uses a simple hash of a seed string.
 */
function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    h = ((h << 5) - h + i) | 0;
    const j = (h >>> 0) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Shuffle answer options deterministically per question+participant.
 * Returns the shuffled answers and the new correct index.
 */
export function shuffleAnswers(
  answers: string[],
  correctIndex: number,
  questionId: string,
  participantId: string,
) {
  const indices = answers.map((_, i) => i);
  const shuffled = seededShuffle(indices, `${questionId}:${participantId}`);
  const shuffledAnswers = shuffled.map((i) => answers[i]);
  const newCorrectIndex = shuffled.indexOf(correctIndex);
  return { shuffledAnswers, newCorrectIndex };
}
