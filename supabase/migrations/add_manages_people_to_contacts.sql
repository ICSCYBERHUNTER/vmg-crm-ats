ALTER TABLE company_contacts
ADD COLUMN manages_people boolean;

COMMENT ON COLUMN company_contacts.manages_people IS
  'Nullable. NULL = unknown, true = has direct reports, false = IC.
   Solves title inflation (e.g., "VP" who is actually an IC).';
