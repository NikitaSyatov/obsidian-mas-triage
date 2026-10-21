import { Vault } from "../types/vault";
import { ObsidianVaultAdapter } from "./ObsidianVaultAdapter";
import { FsVaultAdapter } from "./FsVaultAdapter";

export { ObsidianVaultAdapter } from "./ObsidianVaultAdapter";
export { FsVaultAdapter } from "./FsVaultAdapter";
export { ObsidianVaultAdapter as VaultAdapter };

export function createVaultAdapter(mode: "obsidian" | "fs", opts: any = {}): Vault {
  if (mode === "fs") {
    return new FsVaultAdapter(opts.rootPath || opts.vaultPath || "./datasets/synthetic_vault", opts.inboxPath || "00-Inbox");
  }
  // obsidian mode expects app passed separately
  return new ObsidianVaultAdapter(opts.app, opts.inboxPath || "00-Inbox");
}
