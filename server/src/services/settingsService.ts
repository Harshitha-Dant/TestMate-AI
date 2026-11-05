import { DEFAULT_API_STUDIO_SETTINGS, DEFAULT_PREFERENCES, type ApiStudioSettings, type Preferences } from "@testmate/shared";
import type { Db } from "../db/connection";
import { settingsRepo } from "../db/repositories/settingsRepo";
import { clampApiStudioSettings, publicPolicy } from "../lib/publicMode";

const API_STUDIO_KEY = "api_studio";
const PREFERENCES_KEY = "preferences";

export const settingsService = {
  /** Effective settings. In public mode they are clamped to safe values (localhost always off). */
  getApiStudio(db: Db): ApiStudioSettings {
    const stored = { ...DEFAULT_API_STUDIO_SETTINGS, ...settingsRepo.get<Partial<ApiStudioSettings>>(db, API_STUDIO_KEY) };
    return clampApiStudioSettings(stored, publicPolicy(db));
  },

  setApiStudio(db: Db, settings: ApiStudioSettings): ApiStudioSettings {
    settingsRepo.set(db, API_STUDIO_KEY, settings);
    return clampApiStudioSettings(settings, publicPolicy(db));
  },

  getPreferences(db: Db): Preferences {
    return { ...DEFAULT_PREFERENCES, ...settingsRepo.get<Partial<Preferences>>(db, PREFERENCES_KEY) };
  },

  setPreferences(db: Db, prefs: Preferences): Preferences {
    settingsRepo.set(db, PREFERENCES_KEY, prefs);
    return prefs;
  },
};
