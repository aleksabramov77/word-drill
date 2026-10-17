import { decodeIdToken, Google } from "arctic";
import { z } from "zod";

export interface Identity {
  /** Постоянный id аккаунта Google (claim sub). */
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

/** Провайдер входа; в тестах подменяется. */
export interface IdentityProvider {
  authorizationUrl(state: string, codeVerifier: string): URL;
  identify(code: string, codeVerifier: string): Promise<Identity>;
}

const claimsSchema = z.object({
  sub: z.string(),
  email: z.string(),
  email_verified: z.boolean().default(false),
  name: z.string().default(""),
});

export const GOOGLE_CALLBACK_PATH = "/api/auth/google/callback";

export function createGoogleProvider(config: {
  clientId: string;
  clientSecret: string;
  siteUrl: string;
}): IdentityProvider {
  const google = new Google(
    config.clientId,
    config.clientSecret,
    `${config.siteUrl}${GOOGLE_CALLBACK_PATH}`,
  );
  return {
    authorizationUrl: (state, codeVerifier) =>
      google.createAuthorizationURL(state, codeVerifier, [
        "openid",
        "email",
        "profile",
      ]),
    identify: async (code, codeVerifier) => {
      const tokens = await google.validateAuthorizationCode(code, codeVerifier);
      const claims = claimsSchema.parse(decodeIdToken(tokens.idToken()));
      return {
        sub: claims.sub,
        email: claims.email.toLowerCase(),
        emailVerified: claims.email_verified,
        name: claims.name,
      };
    },
  };
}
