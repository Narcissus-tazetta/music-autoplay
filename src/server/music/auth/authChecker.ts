import type { HandlerError } from "@/shared/utils/errors";
import { toHandlerError } from "@/shared/utils/errors";
import type { Result } from "@/shared/utils/errors/result-handlers";
import { err, ok } from "@/shared/utils/errors/result-handlers";
import { createHash, timingSafeEqual } from "crypto";
import type ConfigService from "../../config/configService";
import ServiceResolver from "../../utils/serviceResolver";

export interface AuthContext {
  requesterHash?: string;
  socketId?: string;
}

export interface AuthResult {
  isAuthenticated: boolean;
  isAdmin: boolean;
  userId?: string;
}

export class AuthChecker {
  private adminSecretHash?: Buffer;

  constructor(adminSecret?: string) {
    this.initializeAdminSecret(adminSecret);
  }

  private initializeAdminSecret(adminSecret?: string): void {
    let secret = adminSecret;

    if (!secret) {
      try {
        const resolver = ServiceResolver.getInstance();
        const configService = resolver.resolve<ConfigService>("configService");

        if (configService && typeof configService.getString === "function")
          secret = configService.getString("ADMIN_SECRET") ?? undefined;
      } catch {
        secret = undefined;
      }
    }

    if (secret && secret.trim().length > 0) {
      try {
        this.adminSecretHash = createHash("sha256").update(secret).digest();
      } catch {
        this.adminSecretHash = undefined;
      }
    }
  }

  checkAdmin(requesterHash?: string): Result<boolean, HandlerError> {
    if (!requesterHash) return ok(false);

    if (!this.adminSecretHash) return ok(false);

    try {
      let reqHashBuf: Buffer;

      try {
        reqHashBuf = Buffer.from(requesterHash, "hex");
      } catch {
        reqHashBuf = Buffer.from(requesterHash);
      }

      if (this.adminSecretHash.length !== reqHashBuf.length) return ok(false);

      const isAdmin = timingSafeEqual(reqHashBuf, this.adminSecretHash);
      return ok(isAdmin);
    } catch (error: unknown) {
      return err(toHandlerError(error));
    }
  }

  checkPermission(context: AuthContext): Result<AuthResult, HandlerError> {
    try {
      const adminCheckResult = this.checkAdmin(context.requesterHash);

      if (!adminCheckResult.ok) return err(adminCheckResult.error);

      const isAdmin = adminCheckResult.value;

      return ok({
        isAuthenticated: true,
        isAdmin,
        userId: context.requesterHash,
      });
    } catch (error: unknown) {
      return err(toHandlerError(error));
    }
  }

  canRemoveMusic(
    requesterHash?: string,
    ownerHash?: string,
  ): Result<boolean, HandlerError> {
    try {
      if (!ownerHash) {
        const adminCheck = this.checkAdmin(requesterHash);
        if (!adminCheck.ok) return err(adminCheck.error);
        return ok(adminCheck.value);
      }

      if (requesterHash === ownerHash) return ok(true);

      const adminCheck = this.checkAdmin(requesterHash);
      if (!adminCheck.ok) return err(adminCheck.error);

      return ok(adminCheck.value);
    } catch (error: unknown) {
      return err(toHandlerError(error));
    }
  }
}
