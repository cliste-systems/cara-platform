// Regenerate the Irish numbering metadata used by the setup form.
import { writeFileSync } from 'node:fs';
import all from 'libphonenumber-js/metadata.max.json' with { type: 'json' };

const metadata = {
  version: all.version,
  country_calling_codes: { 353: ['IE'] },
  countries: { IE: all.countries.IE },
  nonGeographic: {},
};
writeFileSync('src/lib/irish-phone-metadata.json', JSON.stringify(metadata) + '\n');
