export type QuestionnaireMapping = {
  liked_keywords: number[];
  disliked_keywords: number[];
  liked_platforms: number[];
  disliked_platforms: number[];
};

export type QuestionnaireOption = {
  id: string;
  label: string;
  mapping: QuestionnaireMapping;
};

export type QuestionnaireQuestion = {
  id: string;
  prompt: string;
  type: "single_select" | "multi_select";
  options: QuestionnaireOption[];
};

export type QuestionnaireCatalog = {
  version: string;
  feature_schema_version: string;
  id_catalog: string;
  questions: QuestionnaireQuestion[];
};

export type QuestionnaireAnswers = Record<string, string[]>;

export const QUESTIONNAIRE_V1: QuestionnaireCatalog = {
  version: "questionnaire_v1",
  feature_schema_version: "recommender_feature_schema_v1",
  id_catalog: "postgres_nextplay_catalog_2026_03_10",
  questions: [
    {
      id: "preferred_pace",
      prompt: "What pace do you enjoy most?",
      type: "single_select",
      options: [
        {
          id: "slow_thoughtful",
          label: "Slow and thoughtful",
          mapping: {
            liked_keywords: [3511, 322],
            disliked_keywords: [2835],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "fast_action",
          label: "Fast and action-packed",
          mapping: {
            liked_keywords: [2835, 6149],
            disliked_keywords: [322],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "balanced_mix",
          label: "A balanced mix",
          mapping: {
            liked_keywords: [322, 6149],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
      ],
    },
    {
      id: "session_length",
      prompt: "How long are your typical play sessions?",
      type: "single_select",
      options: [
        {
          id: "under_30_min",
          label: "Under 30 minutes",
          mapping: {
            liked_keywords: [59],
            disliked_keywords: [3903],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "one_to_three_hours",
          label: "1 to 3 hours",
          mapping: {
            liked_keywords: [5420],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "over_three_hours",
          label: "3+ hours",
          mapping: {
            liked_keywords: [5420, 1577],
            disliked_keywords: [59],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
      ],
    },
    {
      id: "play_mode",
      prompt: "How do you usually play?",
      type: "single_select",
      options: [
        {
          id: "solo",
          label: "Solo",
          mapping: {
            liked_keywords: [5262],
            disliked_keywords: [981],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "multiplayer",
          label: "With friends / online",
          mapping: {
            liked_keywords: [981],
            disliked_keywords: [5262],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "both_modes",
          label: "Both solo and multiplayer",
          mapping: {
            liked_keywords: [5262, 981],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
      ],
    },
    {
      id: "challenge_preference",
      prompt: "What challenge level do you prefer?",
      type: "single_select",
      options: [
        {
          id: "relaxed",
          label: "Relaxed",
          mapping: {
            liked_keywords: [5069],
            disliked_keywords: [1962],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "hardcore",
          label: "Hardcore",
          mapping: {
            liked_keywords: [1962],
            disliked_keywords: [5069],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "moderate",
          label: "Moderate / adaptive",
          mapping: {
            liked_keywords: [5069, 1962],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
      ],
    },
    {
      id: "theme_preferences",
      prompt: "Which themes do you enjoy?",
      type: "multi_select",
      options: [
        {
          id: "fantasy",
          label: "Fantasy",
          mapping: {
            liked_keywords: [5536],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "sci_fi",
          label: "Sci-fi",
          mapping: {
            liked_keywords: [3773],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "horror",
          label: "Horror",
          mapping: {
            liked_keywords: [5741],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "mystery",
          label: "Mystery / detective",
          mapping: {
            liked_keywords: [1577],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "competitive",
          label: "Competitive",
          mapping: {
            liked_keywords: [981, 6149],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
      ],
    },
    {
      id: "avoid_content",
      prompt: "Any content you'd rather avoid?",
      type: "multi_select",
      options: [
        {
          id: "heavy_grind",
          label: "Heavy grind",
          mapping: {
            liked_keywords: [],
            disliked_keywords: [3903],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "jump_scares",
          label: "Jump scares",
          mapping: {
            liked_keywords: [],
            disliked_keywords: [3957],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "always_online",
          label: "Always-online requirements",
          mapping: {
            liked_keywords: [],
            disliked_keywords: [981],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "complex_controls",
          label: "Complex control schemes",
          mapping: {
            liked_keywords: [],
            disliked_keywords: [4383],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
      ],
    },
    {
      id: "primary_platform",
      prompt: "What platform do you play on most?",
      type: "single_select",
      options: [
        {
          id: "pc",
          label: "PC",
          mapping: {
            liked_keywords: [],
            disliked_keywords: [],
            liked_platforms: [204],
            disliked_platforms: [],
          },
        },
        {
          id: "playstation",
          label: "PlayStation",
          mapping: {
            liked_keywords: [],
            disliked_keywords: [],
            liked_platforms: [76],
            disliked_platforms: [],
          },
        },
        {
          id: "xbox",
          label: "Xbox",
          mapping: {
            liked_keywords: [],
            disliked_keywords: [],
            liked_platforms: [21],
            disliked_platforms: [],
          },
        },
        {
          id: "nintendo",
          label: "Nintendo",
          mapping: {
            liked_keywords: [],
            disliked_keywords: [],
            liked_platforms: [95],
            disliked_platforms: [],
          },
        },
        {
          id: "handheld_pc",
          label: "Handheld PC",
          mapping: {
            liked_keywords: [],
            disliked_keywords: [],
            liked_platforms: [204],
            disliked_platforms: [],
          },
        },
      ],
    },
    {
      id: "control_preference",
      prompt: "How do you prefer to play?",
      type: "single_select",
      options: [
        {
          id: "controller",
          label: "Controller-first",
          mapping: {
            liked_keywords: [2132],
            disliked_keywords: [],
            liked_platforms: [76, 21, 95],
            disliked_platforms: [],
          },
        },
        {
          id: "mouse_keyboard",
          label: "Mouse and keyboard",
          mapping: {
            liked_keywords: [4383],
            disliked_keywords: [],
            liked_platforms: [204],
            disliked_platforms: [],
          },
        },
        {
          id: "hybrid_input",
          label: "I switch depending on the game",
          mapping: {
            liked_keywords: [2132, 4383],
            disliked_keywords: [],
            liked_platforms: [204, 76, 21, 95],
            disliked_platforms: [],
          },
        },
      ],
    },
    {
      id: "story_vs_gameplay",
      prompt: "What matters more to you?",
      type: "single_select",
      options: [
        {
          id: "story",
          label: "Story and characters",
          mapping: {
            liked_keywords: [1577],
            disliked_keywords: [277],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "gameplay",
          label: "Systems and gameplay depth",
          mapping: {
            liked_keywords: [277],
            disliked_keywords: [1577],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "both_equal",
          label: "Both equally",
          mapping: {
            liked_keywords: [1577, 277],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
      ],
    },
    {
      id: "price_sensitivity",
      prompt: "How price-sensitive are you?",
      type: "single_select",
      options: [
        {
          id: "value_focus",
          label: "I prefer value and discounts",
          mapping: {
            liked_keywords: [2465],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "new_releases",
          label: "I don't mind paying full price",
          mapping: {
            liked_keywords: [2297],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "mix_price_and_new",
          label: "Mix of discounts and new releases",
          mapping: {
            liked_keywords: [2465, 2297],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
      ],
    },
    {
      id: "competitive_vs_chill",
      prompt: "What vibe are you in the mood for right now?",
      type: "single_select",
      options: [
        {
          id: "chill",
          label: "Chill and low pressure",
          mapping: {
            liked_keywords: [5069, 1577],
            disliked_keywords: [1962, 981],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "competitive_vibe",
          label: "Competitive and high intensity",
          mapping: {
            liked_keywords: [1962, 981, 6149],
            disliked_keywords: [5069],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "adventurous_vibe",
          label: "Adventurous and exploratory",
          mapping: {
            liked_keywords: [1577, 5536, 3773],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
      ],
    },
    {
      id: "friction_tolerance",
      prompt: "How much friction can you tolerate?",
      type: "single_select",
      options: [
        {
          id: "minimal_friction",
          label: "Minimal setup, quick to start",
          mapping: {
            liked_keywords: [59, 5069],
            disliked_keywords: [3903],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "some_friction",
          label: "Some complexity is fine",
          mapping: {
            liked_keywords: [277, 4383],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "high_friction_ok",
          label: "I enjoy deep systems",
          mapping: {
            liked_keywords: [3903, 277, 1962],
            disliked_keywords: [59],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
      ],
    },
  ],
};

/**
 * Returns an empty QuestionnaireAnswers object with keys for each question ID.
 */
export const createEmptyQuestionnaireAnswers = (): QuestionnaireAnswers =>
  QUESTIONNAIRE_V1.questions.reduce<QuestionnaireAnswers>((acc, question) => {
    acc[question.id] = [];
    return acc;
  }, {});

/**
 * Takes a stored questionnaire answers object and returns a normalized version.
 *
 * The normalized version will only contain the IDs of the options selected by the user,
 * and will only contain the IDs of options that are valid for the question.
 *
 * If the stored answers are not an object, or if the question ID is not present in
 * the stored answers, the function will return null.
 */
export const normalizeStoredQuestionnaireAnswers = (
  value: unknown,
): QuestionnaireAnswers | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const normalized = createEmptyQuestionnaireAnswers();

  for (const question of QUESTIONNAIRE_V1.questions) {
    const raw = candidate[question.id];
    if (!Array.isArray(raw)) return null;
    const allowed = new Set(question.options.map((option) => option.id));
    const selected = raw.filter(
      (item): item is string => typeof item === "string" && allowed.has(item),
    );
    normalized[question.id] =
      question.type === "single_select" ? selected.slice(0, 1) : selected;
  }

  return normalized;
};

/**
 * Returns true if the questionnaire has been fully completed, false otherwise.
 *
 * A questionnaire is considered fully completed if each question has at least one
 * selected option.
 */
export const isQuestionnaireComplete = (answers: QuestionnaireAnswers): boolean =>
  QUESTIONNAIRE_V1.questions.every((question) => {
    const selected = answers[question.id] ?? [];
    return selected.length > 0;
  });

/**
 * Builds a RecommendRequest object from the given questionnaire answers.
 *
 * The function takes into account the user ID and the answers to the questionnaire,
 * and returns a normalized RecommendRequest object that can be used by the recommender
 * service to generate recommendations.
 *
 * The function iterates over each question in the questionnaire, and for each selected
 * option, adds the corresponding keywords, platforms, and dislikes to the corresponding sets.
 *
 * Finally, the function returns an object containing the user ID, the liked and
 * disliked keywords, the liked and disliked platforms, and the questionnaire answers.
 */
export const buildRecommendRequestFromQuestionnaire = (
  userId: number,
  answers: QuestionnaireAnswers,
) => {
  const likedKeywords = new Set<number>();
  const dislikedKeywords = new Set<number>();
  const likedPlatforms = new Set<number>();
  const dislikedPlatforms = new Set<number>();

  for (const question of QUESTIONNAIRE_V1.questions) {
    const selected = new Set(answers[question.id] ?? []);
    for (const option of question.options) {
      if (!selected.has(option.id)) continue;
      option.mapping.liked_keywords.forEach((id) => likedKeywords.add(id));
      option.mapping.disliked_keywords.forEach((id) => dislikedKeywords.add(id));
      option.mapping.liked_platforms.forEach((id) => likedPlatforms.add(id));
      option.mapping.disliked_platforms.forEach((id) => dislikedPlatforms.add(id));
    }
  }

  return {
    user_id: userId,
    liked_keywords: Array.from(likedKeywords),
    liked_platforms: Array.from(likedPlatforms),
    disliked_keywords: Array.from(dislikedKeywords),
    disliked_platforms: Array.from(dislikedPlatforms),
    questionnaire: {
      version: QUESTIONNAIRE_V1.version,
      feature_schema_version: QUESTIONNAIRE_V1.feature_schema_version,
      id_catalog: QUESTIONNAIRE_V1.id_catalog,
      answers,
    },
  };
};
