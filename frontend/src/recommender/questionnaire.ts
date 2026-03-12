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
  weight?: number;
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
          id: "very_slow_cozy",
          label: "Very slow and cozy",
          mapping: {
            liked_keywords: [5069, 3511],
            disliked_keywords: [2835, 1962],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
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
          id: "balanced_mix",
          label: "A balanced mix",
          mapping: {
            liked_keywords: [322, 6149],
            disliked_keywords: [],
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
          id: "twitch_competitive",
          label: "Fast and highly competitive",
          mapping: {
            liked_keywords: [6149, 981, 1962],
            disliked_keywords: [5069],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "no_pace_preference",
          label: "No strong pace preference",
          mapping: {
            liked_keywords: [],
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
          id: "thirty_to_sixty_min",
          label: "30 to 60 minutes",
          mapping: {
            liked_keywords: [59, 5069],
            disliked_keywords: [],
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
        {
          id: "marathon_weekend",
          label: "Marathon sessions (4+ hours)",
          mapping: {
            liked_keywords: [5420, 3903, 277],
            disliked_keywords: [59],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "varies_by_day",
          label: "It varies a lot",
          mapping: {
            liked_keywords: [59, 5420],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
      ],
    },
    {
      id: "era_preference",
      prompt: "What release era do you usually prefer?",
      type: "single_select",
      weight: 1.15,
      options: [
        {
          id: "classics_90s_00s",
          label: "Classics (90s to 2000s)",
          mapping: {
            liked_keywords: [],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "older_2000s_early_2010s",
          label: "Older gems (2000s to early 2010s)",
          mapping: {
            liked_keywords: [],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "modern_2015_plus",
          label: "Modern (2015+)",
          mapping: {
            liked_keywords: [],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "latest_2020_plus",
          label: "Latest releases (2020+)",
          mapping: {
            liked_keywords: [],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "no_era_preference",
          label: "No era preference",
          mapping: {
            liked_keywords: [],
            disliked_keywords: [],
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
          id: "couch_coop",
          label: "Local co-op / couch play",
          mapping: {
            liked_keywords: [981, 5069],
            disliked_keywords: [],
            liked_platforms: [76, 21, 95],
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
          id: "drop_in_drop_out",
          label: "Drop-in sessions when friends are online",
          mapping: {
            liked_keywords: [981, 59],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "no_mode_preference",
          label: "No preference",
          mapping: {
            liked_keywords: [],
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
          id: "story_easy",
          label: "Story-focused / easy",
          mapping: {
            liked_keywords: [5069, 1577],
            disliked_keywords: [1962],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
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
          id: "moderate",
          label: "Moderate / adaptive",
          mapping: {
            liked_keywords: [5069, 1962],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "scalable_difficulty",
          label: "Adjustable difficulty options",
          mapping: {
            liked_keywords: [5069, 277],
            disliked_keywords: [],
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
          id: "punishing_mastery",
          label: "Punishing but rewarding",
          mapping: {
            liked_keywords: [1962, 277],
            disliked_keywords: [5069],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
      ],
    },
    {
      id: "theme_preferences",
      prompt: "Which genres do you enjoy?",
      type: "multi_select",
      options: [
        {
          id: "point_and_click",
          label: "Point-and-click",
          mapping: {
            liked_keywords: [1577, 322],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "racing",
          label: "Racing",
          mapping: {
            liked_keywords: [6149, 59],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "card_and_board_game",
          label: "Card & Board Game",
          mapping: {
            liked_keywords: [322],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "visual_novel",
          label: "Visual Novel",
          mapping: {
            liked_keywords: [1577, 5069],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "music",
          label: "Music",
          mapping: {
            liked_keywords: [59],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "platform",
          label: "Platform",
          mapping: {
            liked_keywords: [59, 5069],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "pinball",
          label: "Pinball",
          mapping: {
            liked_keywords: [59],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "arcade",
          label: "Arcade",
          mapping: {
            liked_keywords: [59, 6149],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "real_time_strategy_rts",
          label: "Real Time Strategy (RTS)",
          mapping: {
            liked_keywords: [3511, 322, 277],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "sport",
          label: "Sport",
          mapping: {
            liked_keywords: [981, 6149],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "tactical",
          label: "Tactical",
          mapping: {
            liked_keywords: [277, 322],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "quiz_trivia",
          label: "Quiz/Trivia",
          mapping: {
            liked_keywords: [322],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "moba",
          label: "MOBA",
          mapping: {
            liked_keywords: [981, 1962],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "shooter",
          label: "Shooter",
          mapping: {
            liked_keywords: [6149, 1962],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "simulator",
          label: "Simulator",
          mapping: {
            liked_keywords: [3903, 5069],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "strategy",
          label: "Strategy",
          mapping: {
            liked_keywords: [3511, 322, 277],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "adventure",
          label: "Adventure",
          mapping: {
            liked_keywords: [1577, 5069],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "indie",
          label: "Indie",
          mapping: {
            liked_keywords: [5069, 59],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "fighting",
          label: "Fighting",
          mapping: {
            liked_keywords: [1962, 6149],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "puzzle",
          label: "Puzzle",
          mapping: {
            liked_keywords: [322, 59],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "role_playing_rpg",
          label: "Role-playing (RPG)",
          mapping: {
            liked_keywords: [1577, 277, 5536],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "turn_based_strategy_tbs",
          label: "Turn-based strategy (TBS)",
          mapping: {
            liked_keywords: [322, 277],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "hack_and_slash_beat_em_up",
          label: "Hack and slash/Beat 'em up",
          mapping: {
            liked_keywords: [1962, 6149],
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
          id: "toxic_competitive",
          label: "Toxic or sweaty competitive environments",
          mapping: {
            liked_keywords: [],
            disliked_keywords: [981, 1962],
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
        {
          id: "steep_learning_curve",
          label: "Steep learning curves",
          mapping: {
            liked_keywords: [],
            disliked_keywords: [277, 4383, 1962],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "long_commitment_loops",
          label: "Long progression commitments",
          mapping: {
            liked_keywords: [],
            disliked_keywords: [3903, 5420],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "high_intensity_focus",
          label: "High-intensity focus / reaction-heavy gameplay",
          mapping: {
            liked_keywords: [],
            disliked_keywords: [6149, 1962],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "dark_or_horror_tone",
          label: "Dark or horror tone",
          mapping: {
            liked_keywords: [],
            disliked_keywords: [5741],
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
          id: "steam_deck_like",
          label: "Steam Deck / handheld PC",
          mapping: {
            liked_keywords: [],
            disliked_keywords: [],
            liked_platforms: [204],
            disliked_platforms: [],
          },
        },
        {
          id: "pc_playstation_mix",
          label: "Mostly PC + PlayStation",
          mapping: {
            liked_keywords: [],
            disliked_keywords: [],
            liked_platforms: [204, 76],
            disliked_platforms: [],
          },
        },
        {
          id: "pc_xbox_mix",
          label: "Mostly PC + Xbox",
          mapping: {
            liked_keywords: [],
            disliked_keywords: [],
            liked_platforms: [204, 21],
            disliked_platforms: [],
          },
        },
        {
          id: "console_mix",
          label: "Mostly console mix",
          mapping: {
            liked_keywords: [],
            disliked_keywords: [],
            liked_platforms: [76, 21, 95],
            disliked_platforms: [],
          },
        },
        {
          id: "mobile_cloud",
          label: "Mobile or cloud gaming",
          mapping: {
            liked_keywords: [59, 5069],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "no_platform_preference",
          label: "No strong platform preference",
          mapping: {
            liked_keywords: [],
            disliked_keywords: [],
            liked_platforms: [],
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
          id: "touch_motion",
          label: "Touch / motion / adaptive controls",
          mapping: {
            liked_keywords: [5069],
            disliked_keywords: [4383],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "accessibility_focused",
          label: "Accessibility-first controls",
          mapping: {
            liked_keywords: [5069, 59],
            disliked_keywords: [1962],
            liked_platforms: [],
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
        {
          id: "no_control_preference",
          label: "No control preference",
          mapping: {
            liked_keywords: [],
            disliked_keywords: [],
            liked_platforms: [],
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
          id: "exploration",
          label: "Atmosphere and exploration",
          mapping: {
            liked_keywords: [1577, 5069],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "social_hangout",
          label: "Social experience with friends",
          mapping: {
            liked_keywords: [981, 5069],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "no_story_gameplay_preference",
          label: "No strong preference",
          mapping: {
            liked_keywords: [],
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
          id: "subscription_value",
          label: "I prefer subscription libraries",
          mapping: {
            liked_keywords: [2465],
            disliked_keywords: [],
            liked_platforms: [204, 21, 76],
            disliked_platforms: [],
          },
        },
        {
          id: "patient_gamer",
          label: "I wait for bundles / deep sales",
          mapping: {
            liked_keywords: [2465, 59],
            disliked_keywords: [2297],
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
        {
          id: "support_favorites",
          label: "I buy favorites at launch, then wait on others",
          mapping: {
            liked_keywords: [2297, 2465],
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
          id: "not_price_sensitive",
          label: "Price rarely affects my choices",
          mapping: {
            liked_keywords: [2297],
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
          id: "narrative_immersion",
          label: "Immersive and narrative-focused",
          mapping: {
            liked_keywords: [1577, 5069],
            disliked_keywords: [981],
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
          id: "short_burst",
          label: "Short burst sessions",
          mapping: {
            liked_keywords: [59, 6149],
            disliked_keywords: [3903],
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
        {
          id: "mixed_vibe",
          label: "A mix depending on mood",
          mapping: {
            liked_keywords: [5069, 1962, 1577, 981],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "no_vibe_preference",
          label: "No specific vibe right now",
          mapping: {
            liked_keywords: [],
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
          id: "plug_and_play",
          label: "Just launch and play",
          mapping: {
            liked_keywords: [59, 5069],
            disliked_keywords: [277, 3903],
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
          id: "onboarding_then_depth",
          label: "Smooth onboarding, then depth",
          mapping: {
            liked_keywords: [59, 277],
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
        {
          id: "modding_tinkering",
          label: "I like tinkering and systems mastery",
          mapping: {
            liked_keywords: [4383, 3903, 277],
            disliked_keywords: [59],
            liked_platforms: [204],
            disliked_platforms: [],
          },
        },
        {
          id: "no_friction_preference",
          label: "No strong preference",
          mapping: {
            liked_keywords: [],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
      ],
    },
    {
      id: "world_structure",
      prompt: "What kind of world structure sounds best right now?",
      type: "single_select",
      options: [
        {
          id: "linear_guided",
          label: "Linear and guided",
          mapping: {
            liked_keywords: [1577, 59],
            disliked_keywords: [3903],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "open_world",
          label: "Open-world exploration",
          mapping: {
            liked_keywords: [1577, 5536, 3773],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "sandbox_systems",
          label: "Sandbox systems and experimentation",
          mapping: {
            liked_keywords: [277, 4383, 3903],
            disliked_keywords: [59],
            liked_platforms: [204],
            disliked_platforms: [],
          },
        },
        {
          id: "mission_based",
          label: "Mission-based structure",
          mapping: {
            liked_keywords: [59, 277],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "no_world_structure_preference",
          label: "No strong preference",
          mapping: {
            liked_keywords: [],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
      ],
    },
    {
      id: "engagement_goal",
      prompt: "What do you want from your next game?",
      type: "single_select",
      weight: 1.2,
      options: [
        {
          id: "finish_story_once",
          label: "A memorable story to finish once",
          mapping: {
            liked_keywords: [1577, 5069],
            disliked_keywords: [3903],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "mastery_completion",
          label: "Mastery and high skill ceiling",
          mapping: {
            liked_keywords: [1962, 277, 4383],
            disliked_keywords: [59],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "endless_replay",
          label: "Long-term replayability",
          mapping: {
            liked_keywords: [3903, 981],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "social_sessions",
          label: "Great social sessions with friends",
          mapping: {
            liked_keywords: [981, 59],
            disliked_keywords: [5262],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "casual_drop_in",
          label: "Easy drop-in relaxation",
          mapping: {
            liked_keywords: [5069, 59],
            disliked_keywords: [1962, 3903],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
      ],
    },
    {
      id: "narrative_depth",
      prompt: "How much narrative depth do you want?",
      type: "single_select",
      options: [
        {
          id: "minimal_story",
          label: "Minimal story, straight to gameplay",
          mapping: {
            liked_keywords: [277, 6149],
            disliked_keywords: [1577],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "light_story",
          label: "Light story, mostly gameplay",
          mapping: {
            liked_keywords: [277, 59],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "balanced_story",
          label: "Balanced story and gameplay",
          mapping: {
            liked_keywords: [1577, 277],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "deep_narrative",
          label: "Deep narrative and character arcs",
          mapping: {
            liked_keywords: [1577, 5069],
            disliked_keywords: [6149],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
      ],
    },
    {
      id: "progression_style",
      prompt: "Which progression style keeps you engaged?",
      type: "single_select",
      options: [
        {
          id: "skill_mastery",
          label: "Skill mastery and challenge",
          mapping: {
            liked_keywords: [1962, 277],
            disliked_keywords: [3903],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "build_crafting",
          label: "Builds, loot, and crafting",
          mapping: {
            liked_keywords: [3903, 5536],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "world_completion",
          label: "Exploration and completion",
          mapping: {
            liked_keywords: [3773, 1577, 5536],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "quick_match_progress",
          label: "Quick rounds with steady progress",
          mapping: {
            liked_keywords: [59, 981],
            disliked_keywords: [3903],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
      ],
    },
    {
      id: "setting_preference",
      prompt: "Which settings are you in the mood for?",
      type: "multi_select",
      options: [
        {
          id: "fantasy_setting",
          label: "Fantasy worlds",
          mapping: {
            liked_keywords: [5536, 1577],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "sci_fi_setting",
          label: "Sci-fi and futuristic",
          mapping: {
            liked_keywords: [3773, 6149],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "historical_setting",
          label: "Historical / grounded",
          mapping: {
            liked_keywords: [1577, 322],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "horror_setting",
          label: "Dark / horror",
          mapping: {
            liked_keywords: [5741, 1962],
            disliked_keywords: [5069],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "cozy_setting",
          label: "Cozy and uplifting",
          mapping: {
            liked_keywords: [5069, 59],
            disliked_keywords: [5741],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
      ],
    },
    {
      id: "failure_tolerance",
      prompt: "How do you feel about failing and retrying?",
      type: "single_select",
      options: [
        {
          id: "very_low_retry",
          label: "Low tolerance, keep it smooth",
          mapping: {
            liked_keywords: [5069, 59],
            disliked_keywords: [1962],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "moderate_retry",
          label: "Some retries are fine",
          mapping: {
            liked_keywords: [277, 59],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "high_retry",
          label: "High tolerance, I like learning through failure",
          mapping: {
            liked_keywords: [1962, 277, 4383],
            disliked_keywords: [5069],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
      ],
    },
    {
      id: "genre_mix",
      prompt: "Pick up to 3 genres you want right now",
      type: "multi_select",
      weight: 1.25,
      options: [
        {
          id: "genre_mix_rpg",
          label: "RPG / Adventure",
          mapping: {
            liked_keywords: [1577, 5536, 277],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "genre_mix_action",
          label: "Action / Shooter",
          mapping: {
            liked_keywords: [6149, 1962],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "genre_mix_strategy",
          label: "Strategy / Tactics",
          mapping: {
            liked_keywords: [3511, 322, 277],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "genre_mix_sim",
          label: "Sim / Management",
          mapping: {
            liked_keywords: [3903, 4383],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "genre_mix_relax",
          label: "Cozy / Puzzle / Chill",
          mapping: {
            liked_keywords: [5069, 59, 322],
            disliked_keywords: [1962],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "genre_mix_social",
          label: "Multiplayer / Social",
          mapping: {
            liked_keywords: [981, 59],
            disliked_keywords: [5262],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
      ],
    },
    {
      id: "time_commitment",
      prompt: "How much time do you want to commit to your next game?",
      type: "single_select",
      weight: 1.1,
      options: [
        {
          id: "one_night",
          label: "One-night / short experience",
          mapping: {
            liked_keywords: [59, 5069],
            disliked_keywords: [3903, 5420],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "mid_length",
          label: "10 to 25 hours",
          mapping: {
            liked_keywords: [277, 1577],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "long_commitment",
          label: "40+ hour long-form game",
          mapping: {
            liked_keywords: [3903, 5420, 5536],
            disliked_keywords: [59],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "ongoing_live",
          label: "Ongoing game I can keep returning to",
          mapping: {
            liked_keywords: [981, 3903, 59],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
      ],
    },
    {
      id: "complexity_tolerance",
      prompt: "How much mechanical complexity do you want?",
      type: "single_select",
      weight: 1.1,
      options: [
        {
          id: "very_accessible",
          label: "Very accessible, low complexity",
          mapping: {
            liked_keywords: [5069, 59],
            disliked_keywords: [4383, 277],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "moderate_complexity",
          label: "Moderate complexity",
          mapping: {
            liked_keywords: [277, 59],
            disliked_keywords: [],
            liked_platforms: [],
            disliked_platforms: [],
          },
        },
        {
          id: "high_complexity",
          label: "High complexity and systems depth",
          mapping: {
            liked_keywords: [4383, 3903, 277],
            disliked_keywords: [59],
            liked_platforms: [204],
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
 * If the stored answers are not an object, the function returns null.
 * Missing question keys are treated as unanswered to support questionnaire updates.
 */
export const normalizeStoredQuestionnaireAnswers = (
  value: unknown,
): QuestionnaireAnswers | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const normalized = createEmptyQuestionnaireAnswers();

  for (const question of QUESTIONNAIRE_V1.questions) {
    const raw = candidate[question.id];
    if (raw === undefined || raw === null) {
      normalized[question.id] = [];
      continue;
    }
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
  favoriteGameIds: number[] = [],
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

  const questionWeights = Object.fromEntries(
    QUESTIONNAIRE_V1.questions.map((question) => [question.id, question.weight ?? 1]),
  );

  return {
    user_id: userId,
    liked_keywords: Array.from(likedKeywords),
    liked_platforms: Array.from(likedPlatforms),
    disliked_keywords: Array.from(dislikedKeywords),
    disliked_platforms: Array.from(dislikedPlatforms),
    favorite_game_ids: favoriteGameIds.slice(0, 3),
    questionnaire: {
      version: QUESTIONNAIRE_V1.version,
      feature_schema_version: QUESTIONNAIRE_V1.feature_schema_version,
      id_catalog: QUESTIONNAIRE_V1.id_catalog,
      answers,
      question_weights: questionWeights,
      favorite_game_ids: favoriteGameIds.slice(0, 3),
    },
  };
};
