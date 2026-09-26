import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOidcProviderTables1790000000000 implements MigrationInterface {
  name = 'CreateOidcProviderTables1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const base = `
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        "createdBy" varchar,
        "updatedBy" varchar[] NOT NULL DEFAULT '{}'`;

    await queryRunner.query(`
      CREATE TABLE "oidc_clients" (${base},
        "clientId" varchar(64) NOT NULL,
        "secretHash" varchar NOT NULL,
        "secretSalt" varchar NOT NULL,
        "name" varchar NOT NULL,
        "redirectUris" jsonb NOT NULL DEFAULT '[]',
        "active" boolean NOT NULL DEFAULT true
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_oidc_clients_clientId" ON "oidc_clients" ("clientId");`,
    );

    await queryRunner.query(`
      CREATE TABLE "oidc_signing_keys" (${base},
        "kid" varchar(64) NOT NULL,
        "privateKey" text NOT NULL,
        "publicJwk" jsonb NOT NULL,
        "retiredAt" timestamptz
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_oidc_signing_keys_kid" ON "oidc_signing_keys" ("kid");`,
    );

    await queryRunner.query(`
      CREATE TABLE "oidc_consents" (${base},
        "userId" uuid NOT NULL,
        "clientId" uuid NOT NULL,
        "scope" varchar NOT NULL,
        CONSTRAINT "UQ_oidc_consents_user_client" UNIQUE ("userId", "clientId"),
        CONSTRAINT "FK_oidc_consents_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_oidc_consents_client" FOREIGN KEY ("clientId") REFERENCES "oidc_clients"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "oidc_authorization_codes" (${base},
        "codeHash" varchar(64) NOT NULL,
        "clientId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "redirectUri" varchar NOT NULL,
        "scope" varchar NOT NULL,
        "nonce" varchar,
        "codeChallenge" varchar,
        "expiresAt" timestamptz NOT NULL,
        "usedAt" timestamptz,
        CONSTRAINT "FK_oidc_authorization_codes_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_oidc_authorization_codes_client" FOREIGN KEY ("clientId") REFERENCES "oidc_clients"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_oidc_authorization_codes_codeHash" ON "oidc_authorization_codes" ("codeHash");`,
    );

    await queryRunner.query(`
      CREATE TABLE "oidc_access_tokens" (${base},
        "tokenHash" varchar(64) NOT NULL,
        "clientId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "authorizationCodeId" uuid NOT NULL,
        "scope" varchar NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        CONSTRAINT "FK_oidc_access_tokens_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_oidc_access_tokens_client" FOREIGN KEY ("clientId") REFERENCES "oidc_clients"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_oidc_access_tokens_code" FOREIGN KEY ("authorizationCodeId") REFERENCES "oidc_authorization_codes"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_oidc_access_tokens_tokenHash" ON "oidc_access_tokens" ("tokenHash");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "oidc_access_tokens";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "oidc_authorization_codes";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "oidc_consents";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "oidc_signing_keys";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "oidc_clients";`);
  }
}
