# Wrap TTL files into JS files for bundling with library

,all : lib/forms.js lib/vcard.js lib/autocompletePicker.js lib/instituteDetailsQuery.js

lib/forms.js : src/forms.ttl
				(echo 'module.exports = `' ; cat $< ; echo '`') > $@

#organizationForm.js : organizationForm.ttl
#				(echo 'module.exports = `' ; cat organizationForm.ttl; echo '`') >  organizationForm.js

src/vcard.ttl:
				curl  http://www.w3.org/2006/vcard/ns > src/vcard.ttl

lib/vcard.js : src/vcard.ttl
				(echo 'module.exports = `' ; cat $< ; echo '`') >  $@

lib/autocompletePicker.js: src/autocompletePicker.ts
				npx tsc src/*.ts --outDir lib

lib/instituteDetailsQuery.js : src/instituteDetailsQuery.sparql
				(echo 'module.exports = `' ; cat $< ; echo '`') >  $@
