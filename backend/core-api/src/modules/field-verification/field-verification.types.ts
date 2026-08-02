/**
 * `tbl_verification` (`FieldVerificationVisit`) stores residence and office
 * verification as two parallel tracks on the same row (legacy's own
 * physical shape — see the entity's doc comment), not as separate visit
 * rows. This module exposes both tracks through one set of endpoints,
 * dispatching on `track` to whichever column pair applies.
 */
export enum FieldVerificationTrack {
  RESIDENCE = 'RESIDENCE',
  OFFICE = 'OFFICE',
}
