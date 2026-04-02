import { openDB } from "idb";

import { dehydrateWorkspaceData, hydrateWorkspaceData } from "@/lib/resume-document";
import type { WorkspaceData } from "@/lib/types";

const DB_NAME = "resume-craft";
const STORE_NAME = "workspace";
const WORKSPACE_KEY = "active";
const hasIndexedDb = () => typeof indexedDB !== "undefined";

const getDb = () =>
  openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });

export const saveWorkspace = async (workspace: WorkspaceData) => {
  if (!hasIndexedDb()) {
    return;
  }

  try {
    const dehydratedWorkspace = dehydrateWorkspaceData(workspace);

    const db = await getDb();
    await db.put(
      STORE_NAME,
      {
        contentDocument: dehydratedWorkspace.contentDocument,
        templateSession: dehydratedWorkspace.templateSession,
        renderState: dehydratedWorkspace.renderState,
        meta: dehydratedWorkspace.meta,
      },
      WORKSPACE_KEY,
    );
  } catch {
    // IndexedDB unavailable (Firefox private mode, quota exceeded, etc.)
  }
};

export const loadWorkspace = async (): Promise<WorkspaceData | undefined> => {
  if (!hasIndexedDb()) {
    return undefined;
  }
  try {
    const db = await getDb();
    const persisted = await db.get(STORE_NAME, WORKSPACE_KEY);
    return hydrateWorkspaceData(persisted);
  } catch {
    return undefined;
  }
};

export const clearWorkspace = async () => {
  if (!hasIndexedDb()) {
    return;
  }
  try {
    const db = await getDb();
    await db.delete(STORE_NAME, WORKSPACE_KEY);
  } catch {
    // IndexedDB unavailable
  }
};
