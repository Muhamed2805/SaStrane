import { ValidateIf } from 'class-validator';

// Like IsOptional, but only for a missing field. A null still goes through
// the other validators and fails them, so a required column is never
// cleared.
export function IsOmittable() {
  return ValidateIf((_object, value) => value !== undefined);
}
