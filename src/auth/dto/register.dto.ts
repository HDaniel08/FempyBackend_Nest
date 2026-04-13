/**
 * RegisterDto:
 * - A kliens ezt küldi regisztrációnál.
 * - Tenantot NEM küldünk bodyban: tenant a headerből jön (x-tenant-slug).
 */
export class RegisterDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}