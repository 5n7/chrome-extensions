import { storage } from "#imports";

/** Whether the Guard is on; it is on after install. */
export const guard = storage.defineItem<boolean>("sync:guard", { fallback: true });
