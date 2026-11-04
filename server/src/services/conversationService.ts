import type { ConversationScript } from "@testmate/shared";
import type { Db } from "../db/connection";
import { conversationRepo, type ScriptWrite } from "../db/repositories/conversationRepo";
import { notFound } from "../lib/errors";
import { suiteService } from "./suiteService";

export const conversationService = {
  list: (db: Db, projectId: number, suiteId?: number | "none") => conversationRepo.list(db, projectId, suiteId),

  get(db: Db, projectId: number, id: number): ConversationScript {
    const script = conversationRepo.get(db, projectId, id);
    if (!script) throw notFound("Conversation script");
    return script;
  },

  create(db: Db, projectId: number, input: ScriptWrite): ConversationScript {
    if (input.suiteId !== null) suiteService.assertInModule(db, projectId, input.suiteId, "memory");
    return conversationService.get(db, projectId, conversationRepo.create(db, projectId, input));
  },

  update(db: Db, projectId: number, id: number, input: ScriptWrite): ConversationScript {
    conversationService.get(db, projectId, id);
    if (input.suiteId !== null) suiteService.assertInModule(db, projectId, input.suiteId, "memory");
    conversationRepo.update(db, projectId, id, input);
    return conversationService.get(db, projectId, id);
  },

  remove(db: Db, projectId: number, id: number): void {
    if (!conversationRepo.remove(db, projectId, id)) throw notFound("Conversation script");
  },
};
