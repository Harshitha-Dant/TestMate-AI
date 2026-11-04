import { DEFAULT_API_STUDIO_SETTINGS, DEFAULT_PREFERENCES, type ApiStudioSettings, type Preferences } from "@testmate/shared";
import type { Db } from "../db/connection";
import { settingsRepo } from "../db/repositories/settingsRepo";

const API_STUDIO_KEY = "api_studio";
const PREFERENCES_KEY = "preferences";

export const settingsService = {
  getApiStudio(db: Db): ApiStudioSettings {
    return { ...DEFAULT_API_STUDIO_SETTINGS, ...settingsRepo.get<Partial<ApiStudioSettings>>(db, API_STUDIO_KEY) };
  },

  setApiStudio(db: Db, settings: ApiStudioSettings): ApiStudioSettings {
    settingsRepo.set(db, API_STUDIO_KEY, settings);
    return settings;
  },

  getPreferences(db: Db): Preferences {
    return { ...DEFAULT_PREFERENCES, ...settingsRepo.get<Partial<Preferences>>(db, PREFERENCES_KEY) };
  },

  setPreferences(db: Db, prefs: Preferences): Preferences {
    settingsRepo.set(db, PREFERENCES_KEY, prefs);
    return prefs;
  },
};
