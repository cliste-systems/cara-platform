// Refresh after upgrading libphonenumber-js; only IE data is shipped to the form.
const fs=require('node:fs');
const all=require('libphonenumber-js/metadata.max.json');
const metadata={version:all.version,country_calling_codes:{353:['IE']},countries:{IE:all.countries.IE},nonGeographic:{}};
fs.writeFileSync('src/lib/irish-phone-metadata.json',JSON.stringify(metadata)+'\n');
