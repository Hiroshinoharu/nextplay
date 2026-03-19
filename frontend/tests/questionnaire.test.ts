import { describe, expect, it } from "vitest";

import {
  QUESTIONNAIRE_V1,
  buildRecommendRequestFromQuestionnaire,
  createEmptyQuestionnaireAnswers,
  getRecommendationEraPreference,
  isQuestionnaireComplete,
  normalizeStoredQuestionnaireAnswers,
  type QuestionnaireAnswers,
} from "../src/recommender/questionnaire";

/**
 * Builds a completed questionnaire answers object by selecting the first option
 * for every active question.
 *
 * @returns A completed questionnaire answers object.
 */
const buildCompletedAnswers = (): QuestionnaireAnswers => {
  const answers = createEmptyQuestionnaireAnswers();
  for (const question of QUESTIONNAIRE_V1.questions) {
    answers[question.id] = [question.options[0].id];
  }
  return answers;
};

describe("createEmptyQuestionnaireAnswers", () => {
  it("creates an empty answer array for every active question", () => {
    const answers = createEmptyQuestionnaireAnswers();

    expect(Object.keys(answers)).toEqual(
      QUESTIONNAIRE_V1.questions.map((question) => question.id),
    );
    expect(
      Object.values(answers).every(
        (value) => Array.isArray(value) && value.length === 0,
      ),
    ).toBe(true);
  });
});

describe("normalizeStoredQuestionnaireAnswers", () => {
  it("returns null for invalid stored values", () => {
    expect(normalizeStoredQuestionnaireAnswers("bad")).toBeNull();
  });

  it("filters unknown options and truncates single-select questions", () => {
    const normalized = normalizeStoredQuestionnaireAnswers({
      preferred_pace: ["fast_action", "slow_thoughtful", "not_real"],
      genre_mix: ["genre_mix_action", "genre_mix_relax", "unknown"],
    });

    expect(normalized).not.toBeNull();
    expect(normalized?.preferred_pace).toEqual(["fast_action"]);
    expect(normalized?.genre_mix).toEqual([
      "genre_mix_action",
      "genre_mix_relax",
    ]);
    expect(normalized?.play_mode).toEqual([]);
  });
});

describe("questionnaire completion", () => {
  it("reports completion only when every active question is answered", () => {
    expect(isQuestionnaireComplete(createEmptyQuestionnaireAnswers())).toBe(false);
    expect(isQuestionnaireComplete(buildCompletedAnswers())).toBe(true);
  });
});

describe("recommendation request building", () => {
  it("normalizes era preference and aggregates keyword/platform mappings", () => {
    const answers = createEmptyQuestionnaireAnswers();
    answers.preferred_pace = ["fast_action"];
    answers.era_preference = ["latest_2020_plus"];
    answers.primary_platform = ["pc"];
    answers.avoid_content = ["heavy_grind"];

    const request = buildRecommendRequestFromQuestionnaire(42, answers, [99, 100]);

    expect(getRecommendationEraPreference(answers)).toBe("strict_latest_2020_plus");
    expect(request.user_id).toBe(42);
    expect(request.favorite_game_ids).toEqual([99, 100]);
    expect(request.liked_keywords).toEqual(expect.arrayContaining([2835, 6149]));
    expect(request.disliked_keywords).toEqual(expect.arrayContaining([322, 3903]));
    expect(request.liked_platforms).toEqual([204]);
    expect(request.questionnaire.answers.era_preference).toEqual([
      "strict_latest_2020_plus",
    ]);
    expect(request.questionnaire.question_weights.era_preference).toBe(1.15);
  });
});
